#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <git2.h>
#include <napi.h>
#include <sstream>
#include <string>
#include <sys/stat.h>

#include <git2/sys/errors.h>  // git_error_set_str, for our own auth messages
#include <vector>

namespace {

Napi::Value EnsureRepo(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "repoPath (string) is required")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  return info[0];
}

bool EnsureStringArg(const Napi::CallbackInfo &info, size_t index,
                     const char *name) {
  Napi::Env env = info.Env();
  if (info.Length() <= index || !info[index].IsString()) {
    Napi::TypeError::New(env, std::string(name) + " (string) is required")
        .ThrowAsJavaScriptException();
    return false;
  }
  return true;
}

std::string LastGitErrorOr(const std::string &fallback) {
  const git_error *err = git_error_last();
  if (err != nullptr && err->message != nullptr) {
    return std::string(err->message);
  }
  return fallback;
}

bool ThrowGitError(Napi::Env env, const std::string &fallback) {
  Napi::Error::New(env, LastGitErrorOr(fallback)).ThrowAsJavaScriptException();
  return false;
}

// libgit2 answers a blocked checkout with the bare "N conflicts prevent
// checkout" — it never says WHICH paths, so the user has nothing to act on.
// Registering this as the checkout notify callback records the offending paths
// so the error can name them.
struct CheckoutConflicts {
  std::vector<std::string> paths;
};

int CollectCheckoutConflict(git_checkout_notify_t why, const char *path,
                            const git_diff_file *, const git_diff_file *,
                            const git_diff_file *, void *payload) {
  auto *collected = static_cast<CheckoutConflicts *>(payload);
  if (why == GIT_CHECKOUT_NOTIFY_CONFLICT && path != nullptr &&
      collected != nullptr && collected->paths.size() < 25) {
    collected->paths.push_back(path);
  }
  return 0;
}

// Arms `opts` to collect conflicting paths into `sink`.
void WatchCheckoutConflicts(git_checkout_options *opts,
                            CheckoutConflicts *sink) {
  opts->notify_flags = GIT_CHECKOUT_NOTIFY_CONFLICT;
  opts->notify_cb = CollectCheckoutConflict;
  opts->notify_payload = sink;
}

std::string JoinPaths(const std::vector<std::string> &paths) {
  std::string joined;
  for (size_t i = 0; i < paths.size(); ++i) {
    if (i > 0)
      joined += ", ";
    joined += paths[i];
  }
  return joined;
}

// A path owned by another user (Docker bind mounts are the usual source) fails
// deep inside libgit2 with a bare "Permission denied". Callers can't fix what
// they can't identify, so name the path and the way out.
std::string WithPermissionHint(const std::string &message,
                               const std::string &path) {
  if (message.find("Permission denied") == std::string::npos &&
      message.find("Access is denied") == std::string::npos &&
      message.find("access denied") == std::string::npos) {
    return message;
  }
  std::string where = path.empty() ? std::string("a file in the working tree")
                                   : ("'" + path + "'");
  return message + " — GitBox cannot write " + where +
         ". The file or its folder belongs to another user (this is common with"
         " Docker-created files); fix the ownership, e.g. `sudo chown -R $USER"
         " <folder>`, then try again.";
}

bool SignatureFromConfig(git_repository *repo, git_signature **out) {
  if (git_signature_default(out, repo) == 0) {
    return true;
  }
  return git_signature_now(out, "Gitbox User", "gitbox@local") == 0;
}

bool OpenRepoOrThrow(Napi::Env env, const std::string &path,
                     git_repository **outRepo) {
  if (git_repository_open(outRepo, path.c_str()) != 0) {
    Napi::Error::New(env, LastGitErrorOr("failed to open repository"))
        .ThrowAsJavaScriptException();
    return false;
  }
  return true;
}

std::string CurrentBranchName(git_repository *repo) {
  git_reference *head = nullptr;
  if (git_repository_head(&head, repo) != 0) {
    return "";
  }
  const char *shorthand = git_reference_shorthand(head);
  std::string branch = shorthand != nullptr ? shorthand : "";
  git_reference_free(head);
  return branch;
}

std::string ReadFile(const std::string &path) {
  std::ifstream file(path, std::ios::in | std::ios::binary);
  if (!file)
    return "";
  std::ostringstream ss;
  ss << file.rdbuf();
  return ss.str();
}

std::string HeadFileContent(git_repository *repo, const std::string &filePath) {
  git_object *treeObj = nullptr;
  if (git_revparse_single(&treeObj, repo, "HEAD^{tree}") != 0) {
    return "";
  }
  git_tree *tree = reinterpret_cast<git_tree *>(treeObj);
  git_tree_entry *entry = nullptr;
  if (git_tree_entry_bypath(&entry, tree, filePath.c_str()) != 0) {
    git_object_free(treeObj);
    return "";
  }

  const git_oid *blobOid = git_tree_entry_id(entry);
  git_blob *blob = nullptr;
  if (git_blob_lookup(&blob, repo, blobOid) != 0) {
    git_tree_entry_free(entry);
    git_object_free(treeObj);
    return "";
  }

  const void *raw = git_blob_rawcontent(blob);
  size_t len = git_blob_rawsize(blob);
  std::string content(reinterpret_cast<const char *>(raw), len);

  git_blob_free(blob);
  git_tree_entry_free(entry);
  git_object_free(treeObj);
  return content;
}

std::string StatusToLabel(git_status_t status) {
  if (status & GIT_STATUS_WT_NEW)
    return "untracked";
  if (status & GIT_STATUS_WT_MODIFIED)
    return "modified";
  if (status & GIT_STATUS_WT_DELETED)
    return "deleted";
  if (status & GIT_STATUS_WT_RENAMED)
    return "renamed";
  if (status & GIT_STATUS_WT_TYPECHANGE)
    return "typechange";
  if (status & GIT_STATUS_INDEX_NEW)
    return "staged_new";
  if (status & GIT_STATUS_INDEX_MODIFIED)
    return "staged_modified";
  if (status & GIT_STATUS_INDEX_DELETED)
    return "staged_deleted";
  if (status & GIT_STATUS_INDEX_RENAMED)
    return "staged_renamed";
  if (status & GIT_STATUS_INDEX_TYPECHANGE)
    return "staged_typechange";
  if (status & GIT_STATUS_CONFLICTED)
    return "conflicted";
  return "unknown";
}

Napi::Value Status(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_status_options opts = GIT_STATUS_OPTIONS_INIT;
  opts.show = GIT_STATUS_SHOW_INDEX_AND_WORKDIR;
  opts.flags = GIT_STATUS_OPT_INCLUDE_UNTRACKED |
               GIT_STATUS_OPT_RECURSE_UNTRACKED_DIRS |
               GIT_STATUS_OPT_RENAMES_HEAD_TO_INDEX;

  git_status_list *statusList = nullptr;
  if (git_status_list_new(&statusList, repo, &opts) != 0) {
    git_repository_free(repo);
    Napi::Error::New(env, LastGitErrorOr("failed to get status list"))
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  size_t count = git_status_list_entrycount(statusList);
  Napi::Array result = Napi::Array::New(env);
  uint32_t idx = 0;
  for (size_t i = 0; i < count; ++i) {
    const git_status_entry *entry = git_status_byindex(statusList, i);
    if (entry == nullptr)
      continue;
    const char *pathPtr = nullptr;
    if (entry->head_to_index != nullptr &&
        entry->head_to_index->new_file.path != nullptr) {
      pathPtr = entry->head_to_index->new_file.path;
    } else if (entry->index_to_workdir != nullptr &&
               entry->index_to_workdir->new_file.path != nullptr) {
      pathPtr = entry->index_to_workdir->new_file.path;
    }
    if (pathPtr == nullptr)
      continue;

    Napi::Object item = Napi::Object::New(env);
    item.Set("path", Napi::String::New(env, pathPtr));
    item.Set("status", Napi::String::New(env, StatusToLabel(entry->status)));
    result.Set(idx++, item);
  }

  git_status_list_free(statusList);
  git_repository_free(repo);
  return result;
}

Napi::Value Branches(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_branch_iterator *it = nullptr;
  if (git_branch_iterator_new(&it, repo, GIT_BRANCH_ALL) != 0) {
    git_repository_free(repo);
    Napi::Error::New(env, LastGitErrorOr("failed to iterate branches"))
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array result = Napi::Array::New(env);
  uint32_t idx = 0;
  git_reference *ref = nullptr;
  git_branch_t branchType;
  while (true) {
    int nextRc = git_branch_next(&ref, &branchType, it);
    if (nextRc == GIT_ITEROVER)
      break;
    if (nextRc != 0) {
      if (ref != nullptr)
        git_reference_free(ref);
      git_branch_iterator_free(it);
      git_repository_free(repo);
      Napi::Error::New(env, LastGitErrorOr("failed during branch iteration"))
          .ThrowAsJavaScriptException();
      return env.Null();
    }
    if (ref == nullptr)
      continue;
    const char *name = nullptr;
    if (git_branch_name(&name, ref) == 0 && name != nullptr) {
      Napi::Object item = Napi::Object::New(env);
      item.Set("name", Napi::String::New(env, name));
      int isHead = git_branch_is_head(ref);
      item.Set("is_head", Napi::Boolean::New(env, isHead == 1));
      item.Set("is_remote",
               Napi::Boolean::New(env, branchType == GIT_BRANCH_REMOTE));

      const git_oid *branch_oid = git_reference_target(ref);
      if (branch_oid) {
        char oidStr[GIT_OID_HEXSZ + 1];
        git_oid_tostr(oidStr, sizeof(oidStr), branch_oid);
        item.Set("target", Napi::String::New(env, oidStr));

        git_commit *target_commit = nullptr;
        if (git_commit_lookup(&target_commit, repo, branch_oid) == 0) {
          git_time_t time = git_commit_time(target_commit);
          item.Set("timestamp",
                   Napi::Number::New(env, static_cast<double>(time)));
          git_commit_free(target_commit);
        }
      }

      size_t ahead = 0;
      size_t behind = 0;

      if (branchType == GIT_BRANCH_LOCAL) {
        git_reference *upstream = nullptr;
        if (git_branch_upstream(&upstream, ref) == 0) {
          const git_oid *local_oid = git_reference_target(ref);
          const git_oid *upstream_oid = git_reference_target(upstream);
          if (local_oid && upstream_oid) {
            git_graph_ahead_behind(&ahead, &behind, repo, local_oid,
                                   upstream_oid);
          }
          git_reference_free(upstream);
        }
      }

      item.Set("ahead", Napi::Number::New(env, static_cast<double>(ahead)));
      item.Set("behind", Napi::Number::New(env, static_cast<double>(behind)));

      result.Set(idx++, item);
    }
    git_reference_free(ref);
    ref = nullptr;
  }

  if (ref != nullptr)
    git_reference_free(ref);
  git_branch_iterator_free(it);
  git_repository_free(repo);
  return result;
}

Napi::Value Log(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  uint32_t maxCount = 20;
  if (info.Length() > 1 && info[1].IsNumber()) {
    maxCount = info[1].As<Napi::Number>().Uint32Value();
    if (maxCount == 0)
      maxCount = 20;
  }

  std::string refName = "";
  if (info.Length() > 2 && info[2].IsString()) {
    refName = info[2].As<Napi::String>().Utf8Value();
  }

  // Optional pagination offset: skip the first `skip` commits (like `git log
  // --skip`) so the UI can load history incrementally instead of all at once.
  uint32_t skip = 0;
  if (info.Length() > 3 && info[3].IsNumber()) {
    skip = info[3].As<Napi::Number>().Uint32Value();
  }

  git_revwalk *walk = nullptr;
  if (git_revwalk_new(&walk, repo) != 0) {
    git_repository_free(repo);
    Napi::Error::New(env, LastGitErrorOr("failed to create revwalk"))
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  // Topological order (like `git log --graph` / SourceGit) emits each branch's
  // commits contiguously, so graph lanes open and close quickly instead of
  // staying open across time-interleaved commits from many branches. Without
  // this the graph fans out into dozens of parallel lanes. GIT_SORT_TIME is
  // kept as the tie-breaker so commits still read newest-first.
  git_revwalk_sorting(walk, GIT_SORT_TOPOLOGICAL | GIT_SORT_TIME);

  if (refName == "ALL") {
    git_revwalk_push_glob(walk, "refs/heads/*");
    git_revwalk_push_glob(walk, "refs/remotes/*");
    git_revwalk_push_glob(walk, "refs/tags/*");
    git_revwalk_push_head(walk);
  } else if (refName.empty()) {
    if (git_revwalk_push_head(walk) != 0) {
      git_revwalk_free(walk);
      git_repository_free(repo);
      Napi::Error::New(env, LastGitErrorOr("failed to walk HEAD"))
          .ThrowAsJavaScriptException();
      return env.Null();
    }
  } else {
    // One or more refs, separated by '\n' (multi-branch history filter). Push each
    // resolvable ref onto the walk; libgit2 yields their sorted union with correct
    // pagination. If none resolve, fall back to HEAD so the view is never empty.
    bool pushedAny = false;
    size_t start = 0;
    while (start <= refName.size()) {
      size_t nl = refName.find('\n', start);
      std::string one = (nl == std::string::npos)
                            ? refName.substr(start)
                            : refName.substr(start, nl - start);
      if (!one.empty()) {
        git_object *obj = nullptr;
        if (git_revparse_single(&obj, repo, one.c_str()) == 0) {
          git_revwalk_push(walk, git_object_id(obj));
          git_object_free(obj);
          pushedAny = true;
        }
      }
      if (nl == std::string::npos)
        break;
      start = nl + 1;
    }
    if (!pushedAny)
      git_revwalk_push_head(walk);
  }

  Napi::Array result = Napi::Array::New(env);
  uint32_t idx = 0;
  git_oid oid;
  // Skip the pagination offset first.
  for (uint32_t s = 0; s < skip; ++s) {
    if (git_revwalk_next(&oid, walk) != 0) {
      git_revwalk_free(walk);
      git_repository_free(repo);
      return result; // past the end → empty page
    }
  }
  while (idx < maxCount && git_revwalk_next(&oid, walk) == 0) {
    git_commit *commit = nullptr;
    if (git_commit_lookup(&commit, repo, &oid) != 0) {
      continue;
    }

    char oidStr[GIT_OID_HEXSZ + 1];
    git_oid_tostr(oidStr, sizeof(oidStr), &oid);

    const char *summary = git_commit_summary(commit);
    const char *fullMessage = git_commit_message(commit);
    const git_signature *authorSig = git_commit_author(commit);
    const char *author = (authorSig != nullptr && authorSig->name != nullptr)
                             ? authorSig->name
                             : "unknown";
    const char *authorEmail =
        (authorSig != nullptr && authorSig->email != nullptr)
            ? authorSig->email
            : "unknown@domain.com";

    Napi::Object item = Napi::Object::New(env);
    item.Set("id", Napi::String::New(env, oidStr));
    item.Set(
        "summary",
        Napi::String::New(env, summary != nullptr ? summary : "(no message)"));
    item.Set("message",
             Napi::String::New(env, fullMessage != nullptr ? fullMessage : ""));
    item.Set("author", Napi::String::New(env, author));
    item.Set("authorEmail", Napi::String::New(env, authorEmail));

    unsigned int parentCount = git_commit_parentcount(commit);
    Napi::Array parentsArr = Napi::Array::New(env);
    for (unsigned int p = 0; p < parentCount; p++) {
      git_commit *parent_commit = nullptr;
      if (git_commit_parent(&parent_commit, commit, p) == 0) {
        const git_oid *pOid = git_commit_id(parent_commit);
        char pOidStr[GIT_OID_HEXSZ + 1];
        git_oid_tostr(pOidStr, sizeof(pOidStr), pOid);

        const char *pSummary = git_commit_summary(parent_commit);
        const git_signature *pAuthorSig = git_commit_author(parent_commit);
        const char *pAuthor =
            (pAuthorSig != nullptr && pAuthorSig->name != nullptr)
                ? pAuthorSig->name
                : "unknown";
        const char *pAuthorEmail =
            (pAuthorSig != nullptr && pAuthorSig->email != nullptr)
                ? pAuthorSig->email
                : "unknown@domain.com";

        Napi::Object pItem = Napi::Object::New(env);
        pItem.Set("id", Napi::String::New(env, pOidStr));
        pItem.Set("summary",
                  Napi::String::New(env, pSummary != nullptr ? pSummary
                                                             : "(no message)"));
        pItem.Set("author", Napi::String::New(env, pAuthor));
        pItem.Set("authorEmail", Napi::String::New(env, pAuthorEmail));
        pItem.Set("timestamp",
                  Napi::Number::New(env, static_cast<double>(
                                             git_commit_time(parent_commit))));

        parentsArr.Set(p, pItem);
        git_commit_free(parent_commit);
      }
    }
    item.Set("parents", parentsArr);

    item.Set("timestamp", Napi::Number::New(env, static_cast<double>(
                                                     git_commit_time(commit))));
    result.Set(idx++, item);

    git_commit_free(commit);
  }

  git_revwalk_free(walk);
  git_repository_free(repo);
  return result;
}

struct AddAllPayload {
  std::string workdir; // repo workdir, with trailing slash
};

// git_index_add_all callback: skip embedded git repositories (a directory with
// its own .git that isn't a registered submodule). libgit2 rejects adding those
// as "invalid path", which would abort the whole stage-all; the git CLI merely
// warns and skips/gitlinks them, so we skip them too.
int StageAllSkipEmbedded(const char *path, const char * /*matched_pathspec*/,
                         void *payload) {
  auto *p = static_cast<AddAllPayload *>(payload);
  std::string rel = path ? path : "";
  if (!rel.empty() && rel.back() == '/')
    rel.pop_back();
  std::string gitPath = p->workdir + rel + "/.git";
  struct stat st;
  if (stat(gitPath.c_str(), &st) == 0) {
    return 1; // embedded repo → skip this entry, keep staging the rest
  }
  return 0; // add
}

Napi::Value StageAll(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_index *index = nullptr;
  if (git_repository_index(&index, repo) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to open index"), env.Null();
  }

  const char *wd = git_repository_workdir(repo);
  AddAllPayload payload{wd ? std::string(wd) : std::string()};

  git_strarray pathspec = {nullptr, 0};
  if (git_index_add_all(index, &pathspec, GIT_INDEX_ADD_DEFAULT,
                        StageAllSkipEmbedded, &payload) != 0 ||
      git_index_write(index) != 0) {
    git_index_free(index);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to stage files"), env.Null();
  }

  git_index_free(index);
  git_repository_free(repo);
  return Napi::Boolean::New(env, true);
}

Napi::Value UnstageAll(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_object *headTarget = nullptr;
  if (git_revparse_single(&headTarget, repo, "HEAD^{tree}") != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to resolve HEAD tree"), env.Null();
  }

  git_index *index = nullptr;
  if (git_repository_index(&index, repo) != 0) {
    git_object_free(headTarget);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to open index"), env.Null();
  }

  if (git_index_read_tree(index, reinterpret_cast<git_tree *>(headTarget)) !=
          0 ||
      git_index_write(index) != 0) {
    git_index_free(index);
    git_object_free(headTarget);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to unstage files"), env.Null();
  }

  git_index_free(index);
  git_object_free(headTarget);
  git_repository_free(repo);
  return Napi::Boolean::New(env, true);
}

Napi::Value DiscardAll(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_object *target = nullptr;
  if (git_revparse_single(&target, repo, "HEAD^{tree}") != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to resolve HEAD tree"), env.Null();
  }

  git_checkout_options opts = GIT_CHECKOUT_OPTIONS_INIT;
  opts.checkout_strategy = GIT_CHECKOUT_FORCE | GIT_CHECKOUT_RECREATE_MISSING;
  if (git_checkout_tree(repo, target, &opts) != 0) {
    std::string message =
        WithPermissionHint(LastGitErrorOr("failed to discard changes"), "");
    git_object_free(target);
    git_repository_free(repo);
    Napi::Error::New(env, message).ThrowAsJavaScriptException();
    return env.Null();
  }

  git_object_free(target);
  git_repository_free(repo);
  return Napi::Boolean::New(env, true);
}

// Discards the working-tree (and staged) change for a single path, natively —
// the shell-out this replaced needed a system `git`, which packaged GitBox does
// not ship, and it reported failures as raw CLI stderr.
//
// Three cases, decided by whether HEAD knows the path:
//   in HEAD      -> reset the index entry and re-checkout the file from HEAD
//   not in HEAD  -> drop any index entry and delete the file from disk
// Deleting is confined to the requested path, so ignored files elsewhere (.env,
// node_modules, build output) are never touched.
Napi::Value DiscardFile(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "filePath"))
    return env.Null();

  std::string repoPath = repoValue.As<Napi::String>().Utf8Value();
  std::string filePath = info[1].As<Napi::String>().Utf8Value();

  git_repository *repo = nullptr;
  if (!OpenRepoOrThrow(env, repoPath, &repo)) {
    return env.Null();
  }

  git_object *headTree = nullptr;
  bool inHead = false;
  if (git_revparse_single(&headTree, repo, "HEAD^{tree}") == 0) {
    git_tree_entry *entry = nullptr;
    if (git_tree_entry_bypath(&entry, reinterpret_cast<git_tree *>(headTree),
                              filePath.c_str()) == 0) {
      inHead = true;
      git_tree_entry_free(entry);
    }
  }

  char *pathspecEntry = const_cast<char *>(filePath.c_str());
  git_strarray pathspec = {&pathspecEntry, 1};

  if (!inHead) {
    // Unstage it (no-op when it was never staged), then remove it from disk.
    git_object *headCommit = nullptr;
    if (git_revparse_single(&headCommit, repo, "HEAD^{commit}") == 0) {
      git_reset_default(repo, headCommit, &pathspec);
      git_object_free(headCommit);
    }
    std::error_code ec;
    std::filesystem::path onDisk =
        std::filesystem::path(git_repository_workdir(repo) != nullptr
                                  ? git_repository_workdir(repo)
                                  : repoPath.c_str()) /
        filePath;
    std::filesystem::remove_all(onDisk, ec);
    if (headTree != nullptr)
      git_object_free(headTree);
    git_repository_free(repo);
    if (ec) {
      Napi::Error::New(env, WithPermissionHint(ec.message(), filePath))
          .ThrowAsJavaScriptException();
      return env.Null();
    }
    return Napi::Boolean::New(env, true);
  }

  git_object *headCommit = nullptr;
  if (git_revparse_single(&headCommit, repo, "HEAD^{commit}") == 0) {
    // Clears a staged modification so the checkout below restores HEAD's copy
    // in the index as well as in the working tree.
    git_reset_default(repo, headCommit, &pathspec);
    git_object_free(headCommit);
  }

  git_checkout_options opts = GIT_CHECKOUT_OPTIONS_INIT;
  opts.checkout_strategy = GIT_CHECKOUT_FORCE | GIT_CHECKOUT_RECREATE_MISSING |
                           GIT_CHECKOUT_DISABLE_PATHSPEC_MATCH;
  opts.paths = pathspec;
  int rc = git_checkout_head(repo, &opts);
  std::string message =
      rc == 0 ? std::string()
              : WithPermissionHint(LastGitErrorOr("failed to discard file"),
                                   filePath);

  if (headTree != nullptr)
    git_object_free(headTree);
  git_repository_free(repo);

  if (rc != 0) {
    Napi::Error::New(env, message).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Boolean::New(env, true);
}

Napi::Value CommitAll(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "message"))
    return env.Null();

  std::string message = info[1].As<Napi::String>().Utf8Value();
  if (message.empty()) {
    Napi::TypeError::New(env, "message must not be empty")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_index *index = nullptr;
  if (git_repository_index(&index, repo) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to open index"), env.Null();
  }

  git_oid treeOid;
  if (git_index_write_tree(&treeOid, index) != 0 ||
      git_index_write(index) != 0) {
    git_index_free(index);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to write tree"), env.Null();
  }

  git_tree *tree = nullptr;
  if (git_tree_lookup(&tree, repo, &treeOid) != 0) {
    git_index_free(index);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to lookup tree"), env.Null();
  }

  git_signature *sig = nullptr;
  if (!SignatureFromConfig(repo, &sig)) {
    git_tree_free(tree);
    git_index_free(index);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to create commit signature"), env.Null();
  }

  git_reference *headRef = nullptr;
  git_commit *parent = nullptr;
  std::vector<const git_commit *> parents;
  if (git_repository_head(&headRef, repo) == 0) {
    const git_oid *parentOid = git_reference_target(headRef);
    if (parentOid != nullptr &&
        git_commit_lookup(&parent, repo, parentOid) == 0) {
      parents.push_back(parent);
    }
  }

  git_oid commitOid;
  int commitRc =
      git_commit_create(&commitOid, repo, "HEAD", sig, sig, nullptr,
                        message.c_str(), tree, static_cast<int>(parents.size()),
                        parents.empty() ? nullptr : parents.data());

  if (headRef != nullptr)
    git_reference_free(headRef);
  if (parent != nullptr)
    git_commit_free(parent);
  git_signature_free(sig);
  git_tree_free(tree);
  git_index_free(index);

  if (commitRc != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to create commit"), env.Null();
  }

  char oidStr[GIT_OID_HEXSZ + 1];
  git_oid_tostr(oidStr, sizeof(oidStr), &commitOid);
  git_repository_free(repo);
  return Napi::String::New(env, oidStr);
}

Napi::Value CheckoutBranch(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "branchName"))
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string branchName = info[1].As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_reference *branchRef = nullptr;
  if (git_branch_lookup(&branchRef, repo, branchName.c_str(),
                        GIT_BRANCH_LOCAL) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to find branch"), env.Null();
  }

  git_object *target = nullptr;
  if (git_reference_peel(&target, branchRef, GIT_OBJECT_COMMIT) != 0) {
    git_reference_free(branchRef);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to peel branch target"), env.Null();
  }

  git_checkout_options opts = GIT_CHECKOUT_OPTIONS_INIT;
  opts.checkout_strategy = GIT_CHECKOUT_SAFE;
  if (git_checkout_tree(repo, target, &opts) != 0) {
    git_object_free(target);
    git_reference_free(branchRef);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to checkout branch"), env.Null();
  }

  if (git_repository_set_head(repo, git_reference_name(branchRef)) != 0) {
    git_object_free(target);
    git_reference_free(branchRef);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to set HEAD"), env.Null();
  }

  git_object_free(target);
  git_reference_free(branchRef);
  git_repository_free(repo);
  return Napi::Boolean::New(env, true);
}

// ---------------------------------------------------------------------------
// Native network auth (HTTPS). GitBox must not require the git CLI, so remote
// operations run through libgit2 with our own credential callback. The token
// (a GitHub/GitLab/Bitbucket PAT) is passed in from JS; TLS trust comes from a
// bundled CA file installed via SetTlsCertFile at startup.
// ---------------------------------------------------------------------------
struct CredPayload {
  std::string username;
  std::string token;
  int tried;
  // SSH state, carried across callback invocations: libgit2 calls the callback
  // again after each rejected credential, and without this the same agent/key
  // would be offered forever instead of falling through to the next candidate.
  bool sshAgentTried;
  int sshKeyIndex;
};

// Home directory, for locating ~/.ssh. HOME is set on Linux/macOS; Windows
// splits it across USERPROFILE (or HOMEDRIVE+HOMEPATH).
std::string HomeDir() {
  const char *home = std::getenv("HOME");
  if (home && *home)
    return home;
  const char *profile = std::getenv("USERPROFILE");
  if (profile && *profile)
    return profile;
  const char *drive = std::getenv("HOMEDRIVE");
  const char *rest = std::getenv("HOMEPATH");
  if (drive && rest)
    return std::string(drive) + rest;
  return "";
}

// Private key names OpenSSH generates, newest algorithm first — the same order
// ssh(1) tries them in. A matching .pub is required by libssh2 for some key
// types, so both paths are handed over when the public half exists.
const char *kSshKeyNames[] = {"id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"};

int SshCredentials(git_credential **out, const char *username_from_url,
                   CredPayload *p) {
  const char *user =
      username_from_url && *username_from_url ? username_from_url : "git";

  // 1. ssh-agent. What most developers actually use, and the only way a
  //    passphrase-protected key works without prompting — the agent holds the
  //    decrypted key. Note this call succeeds even with no agent running: it
  //    only records the intent, and the failure surfaces later in the
  //    handshake. Hence sshAgentTried, so the next callback moves on to files.
  if (!p->sshAgentTried) {
    p->sshAgentTried = true;
    if (git_credential_ssh_key_from_agent(out, user) == 0)
      return 0;
  }

  // 2. Key files under ~/.ssh, tried one per callback invocation: libgit2 calls
  //    us again after each rejection, so walking the list across calls is what
  //    lets a second key be attempted when the first is not authorised.
  std::string home = HomeDir();
  if (home.empty())
    return GIT_PASSTHROUGH;

  while (p->sshKeyIndex < (int)(sizeof(kSshKeyNames) / sizeof(kSshKeyNames[0]))) {
    std::string base = home + "/.ssh/" + kSshKeyNames[p->sshKeyIndex++];
    std::string pub = base + ".pub";
    struct stat st;
    if (stat(base.c_str(), &st) != 0)
      continue;
    const char *pubPath = stat(pub.c_str(), &st) == 0 ? pub.c_str() : nullptr;
    // Empty passphrase: correct for unencrypted keys, and the only thing we
    // can supply without a prompt. Like the agent above, this call just records
    // the paths — an encrypted key is rejected later, during the handshake, and
    // the next callback invocation moves on to the following candidate.
    if (git_credential_ssh_key_new(out, user, pubPath, base.c_str(), "") == 0)
      return 0;
  }
  return GIT_PASSTHROUGH;
}

int CredentialsCb(git_credential **out, const char * /*url*/,
                  const char *username_from_url, unsigned int allowed_types,
                  void *payload) {
  CredPayload *p = static_cast<CredPayload *>(payload);
  // Give up after a few attempts so a bad token fails instead of looping.
  // SSH needs more headroom: the server asks for the username first, then each
  // key is a separate round.
  if (p->tried++ > 8)
    return GIT_EUSER;

  // SSH asks for the username separately before any key is offered.
  if (allowed_types & GIT_CREDENTIAL_USERNAME) {
    return git_credential_username_new(
        out, username_from_url && *username_from_url ? username_from_url : "git");
  }
  if (allowed_types & GIT_CREDENTIAL_SSH_KEY)
    return SshCredentials(out, username_from_url, p);

  if (allowed_types & GIT_CREDENTIAL_USERPASS_PLAINTEXT) {
    if (p->token.empty()) {
      git_error_set_str(
          GIT_ERROR_NET,
          "authentication required but no credentials are configured");
      return GIT_EUSER;
    }
    const char *user = !p->username.empty()
                           ? p->username.c_str()
                           : (username_from_url ? username_from_url : "oauth2");
    return git_credential_userpass_plaintext_new(out, user, p->token.c_str());
  }
  if (allowed_types & GIT_CREDENTIAL_DEFAULT)
    return git_credential_default_new(out);
  return GIT_PASSTHROUGH;
}

// Read an optional token argument at `index` and, when present, wire our
// credential callback into a remote_callbacks struct. `cred` must outlive the
// synchronous fetch/push call that uses these callbacks.
void ApplyAuth(const Napi::CallbackInfo &info, size_t index,
               git_remote_callbacks *cbs, CredPayload *cred) {
  std::string token;
  if (info.Length() > index && info[index].IsString())
    token = info[index].As<Napi::String>().Utf8Value();
  cred->username = "oauth2";
  cred->token = token;
  cred->tried = 0;
  cred->sshAgentTried = false;
  cred->sshKeyIndex = 0;
  cbs->credentials = CredentialsCb;
  cbs->payload = cred;
}

// Network git ops (fetch/pull/push/clone) run over the network and can take tens
// of seconds. Doing them on the JS thread froze the whole Electron UI ("not
// responding" until they returned), so they run on a libuv worker thread and
// resolve a Promise. Each worker opens its own git_repository handle (libgit2 is
// thread-safe across separate handles) and keeps its credential payload as a
// member so it outlives the async call. This base handles the Promise plumbing;
// subclasses only implement Execute() (no V8/Napi access allowed in there).
class BoolPromiseWorker : public Napi::AsyncWorker {
 public:
  explicit BoolPromiseWorker(Napi::Env env)
      : Napi::AsyncWorker(env),
        deferred_(Napi::Promise::Deferred::New(env)) {}

  Napi::Promise GetPromise() { return deferred_.Promise(); }

  void OnOK() override {
    Napi::HandleScope scope(Env());
    deferred_.Resolve(Napi::Boolean::New(Env(), true));
  }

  void OnError(const Napi::Error &e) override {
    Napi::HandleScope scope(Env());
    deferred_.Reject(e.Value());
  }

 protected:
  // Wires the credential callback for one network call. `user` is the HTTP basic
  // username: GitHub/GitLab PATs are happy with the conventional "oauth2", but a
  // self-hosted server (GitLab CE, Gitea, Azure DevOps) can require the real
  // account name, so callers pass it through instead of it being hardcoded here.
  void SetupAuth(git_remote_callbacks *cbs, const std::string &token,
                 const std::string &user) {
    cred_.username = user.empty() ? "oauth2" : user;
    cred_.token = token;
    cred_.tried = 0;
    cred_.sshAgentTried = false;
    cred_.sshKeyIndex = 0;
    // Always wired, even with an empty token: an SSH remote authenticates with
    // a key from the agent or ~/.ssh and needs no token at all. The callback
    // itself reports "nothing configured" for the HTTPS-without-token case.
    cbs->credentials = CredentialsCb;
    cbs->payload = &cred_;
  }

  Napi::Promise::Deferred deferred_;
  CredPayload cred_;
};

class FetchWorker : public BoolPromiseWorker {
 public:
  FetchWorker(Napi::Env env, std::string repoPath, std::string remoteName,
              std::string token, std::string user)
      : BoolPromiseWorker(env),
        repoPath_(std::move(repoPath)),
        remoteName_(std::move(remoteName)),
        token_(std::move(token)),
        user_(std::move(user)) {}

  void Execute() override {
    git_repository *repo = nullptr;
    if (git_repository_open(&repo, repoPath_.c_str()) != 0) {
      SetError(LastGitErrorOr("failed to open repository"));
      return;
    }
    git_remote *remote = nullptr;
    if (git_remote_lookup(&remote, repo, remoteName_.c_str()) != 0) {
      git_repository_free(repo);
      SetError(LastGitErrorOr("failed to find remote"));
      return;
    }
    git_fetch_options opts = GIT_FETCH_OPTIONS_INIT;
    SetupAuth(&opts.callbacks, token_, user_);
    int rc = git_remote_fetch(remote, nullptr, &opts, nullptr);
    git_remote_free(remote);
    git_repository_free(repo);
    if (rc != 0) {
      SetError(LastGitErrorOr("fetch failed"));
    }
  }

 private:
  std::string repoPath_;
  std::string remoteName_;
  std::string token_;
  std::string user_;
};

Napi::Value Fetch(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "repoPath (string) is required")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string path = info[0].As<Napi::String>().Utf8Value();
  std::string remoteName = "origin";
  if (info.Length() > 1 && info[1].IsString()) {
    remoteName = info[1].As<Napi::String>().Utf8Value();
  }
  std::string token;
  if (info.Length() > 2 && info[2].IsString()) {
    token = info[2].As<Napi::String>().Utf8Value();
  }
  std::string user;
  if (info.Length() > 3 && info[3].IsString()) {
    user = info[3].As<Napi::String>().Utf8Value();
  }

  FetchWorker *worker = new FetchWorker(env, path, remoteName, token, user);
  Napi::Promise promise = worker->GetPromise();
  worker->Queue();
  return promise;
}

// Validate credentials against a remote WITHOUT cloning: open a detached remote,
// run the auth handshake and read the ref advertisement, then disconnect. No
// objects are transferred, so it is cheap and safe to run from a dialog. Resolves
// true on success; rejects with the auth/transport error otherwise.
class TestCredentialsWorker : public BoolPromiseWorker {
 public:
  TestCredentialsWorker(Napi::Env env, std::string url, std::string token,
                        std::string user)
      : BoolPromiseWorker(env),
        url_(std::move(url)),
        token_(std::move(token)),
        user_(std::move(user)) {}

  void Execute() override {
    git_remote *remote = nullptr;
    if (git_remote_create_detached(&remote, url_.c_str()) != 0) {
      SetError(LastGitErrorOr("invalid remote URL"));
      return;
    }
    git_remote_callbacks cbs = GIT_REMOTE_CALLBACKS_INIT;
    SetupAuth(&cbs, token_, user_);
    // connect performs the TLS + auth handshake but transfers nothing.
    int rc = git_remote_connect(remote, GIT_DIRECTION_FETCH, &cbs, nullptr,
                                nullptr);
    if (rc == 0) {
      // Some servers accept the connection then refuse to advertise refs; listing
      // exercises authorization end to end, so a private repo the token cannot see
      // still reports as a failure rather than a false "valid".
      const git_remote_head **heads = nullptr;
      size_t n = 0;
      rc = git_remote_ls(&heads, &n, remote);
      git_remote_disconnect(remote);
    }
    git_remote_free(remote);
    if (rc != 0) {
      SetError(LastGitErrorOr("authentication failed"));
    }
  }

 private:
  std::string url_;
  std::string token_;
  std::string user_;
};

Napi::Value TestCredentials(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "url (string) is required")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string url = info[0].As<Napi::String>().Utf8Value();
  std::string token;
  if (info.Length() > 1 && info[1].IsString()) {
    token = info[1].As<Napi::String>().Utf8Value();
  }
  std::string user;
  if (info.Length() > 2 && info[2].IsString()) {
    user = info[2].As<Napi::String>().Utf8Value();
  }
  TestCredentialsWorker *worker = new TestCredentialsWorker(env, url, token, user);
  Napi::Promise promise = worker->GetPromise();
  worker->Queue();
  return promise;
}

// Pull = fetch + fast-forward. All of it (network + checkout) runs off-thread.
class PullWorker : public BoolPromiseWorker {
 public:
  PullWorker(Napi::Env env, std::string repoPath, std::string remoteName,
             std::string token, std::string user)
      : BoolPromiseWorker(env),
        repoPath_(std::move(repoPath)),
        remoteName_(std::move(remoteName)),
        token_(std::move(token)),
        user_(std::move(user)) {}

  void Execute() override {
    git_repository *repo = nullptr;
    if (git_repository_open(&repo, repoPath_.c_str()) != 0) {
      SetError(LastGitErrorOr("failed to open repository"));
      return;
    }
    std::string branch = CurrentBranchName(repo);
    if (branch.empty()) {
      git_repository_free(repo);
      SetError("detached HEAD is not supported for pull");
      return;
    }
    git_remote *remote = nullptr;
    if (git_remote_lookup(&remote, repo, remoteName_.c_str()) != 0) {
      git_repository_free(repo);
      SetError(LastGitErrorOr("failed to find remote"));
      return;
    }
    git_fetch_options fetchOpts = GIT_FETCH_OPTIONS_INIT;
    SetupAuth(&fetchOpts.callbacks, token_, user_);
    if (git_remote_fetch(remote, nullptr, &fetchOpts, nullptr) != 0) {
      git_remote_free(remote);
      git_repository_free(repo);
      SetError(LastGitErrorOr("pull fetch failed"));
      return;
    }
    git_remote_free(remote);

    std::string remoteRefName = "refs/remotes/" + remoteName_ + "/" + branch;
    git_reference *remoteRef = nullptr;
    if (git_reference_lookup(&remoteRef, repo, remoteRefName.c_str()) != 0) {
      git_repository_free(repo);
      SetError(LastGitErrorOr("remote tracking branch not found"));
      return;
    }
    git_annotated_commit *remoteHead = nullptr;
    if (git_annotated_commit_from_ref(&remoteHead, repo, remoteRef) != 0) {
      git_reference_free(remoteRef);
      git_repository_free(repo);
      SetError(LastGitErrorOr("failed to read remote head"));
      return;
    }
    const git_annotated_commit *heads[] = {remoteHead};
    git_merge_analysis_t analysis;
    git_merge_preference_t pref;
    if (git_merge_analysis(&analysis, &pref, repo, heads, 1) != 0) {
      git_annotated_commit_free(remoteHead);
      git_reference_free(remoteRef);
      git_repository_free(repo);
      SetError(LastGitErrorOr("failed to analyze merge"));
      return;
    }
    if (analysis & GIT_MERGE_ANALYSIS_UP_TO_DATE) {
      git_annotated_commit_free(remoteHead);
      git_reference_free(remoteRef);
      git_repository_free(repo);
      return;  // already up to date -> resolve(true)
    }
    if (!(analysis & GIT_MERGE_ANALYSIS_FASTFORWARD)) {
      git_annotated_commit_free(remoteHead);
      git_reference_free(remoteRef);
      git_repository_free(repo);
      SetError("non-fast-forward pull is not supported yet");
      return;
    }
    const git_oid *targetOid = git_annotated_commit_id(remoteHead);
    git_object *target = nullptr;
    if (git_object_lookup(&target, repo, targetOid, GIT_OBJECT_COMMIT) != 0) {
      git_annotated_commit_free(remoteHead);
      git_reference_free(remoteRef);
      git_repository_free(repo);
      SetError(LastGitErrorOr("failed to lookup fetched commit"));
      return;
    }
    git_checkout_options checkoutOpts = GIT_CHECKOUT_OPTIONS_INIT;
    checkoutOpts.checkout_strategy = GIT_CHECKOUT_SAFE;
    CheckoutConflicts blocked;
    WatchCheckoutConflicts(&checkoutOpts, &blocked);
    if (git_checkout_tree(repo, target, &checkoutOpts) != 0) {
      std::string message = LastGitErrorOr("failed to fast-forward working tree");
      // The fetch already landed; only the working-tree update was refused. Name
      // the paths so the caller can offer to stash/discard them.
      if (!blocked.paths.empty()) {
        message = "local changes would be overwritten by pull: " +
                  JoinPaths(blocked.paths);
      }
      message = WithPermissionHint(
          message, blocked.paths.empty() ? std::string() : blocked.paths[0]);
      git_object_free(target);
      git_annotated_commit_free(remoteHead);
      git_reference_free(remoteRef);
      git_repository_free(repo);
      SetError(message);
      return;
    }
    if (git_reference_set_target(&remoteRef, remoteRef, targetOid,
                                 "gitbox pull") != 0) {
      git_object_free(target);
      git_annotated_commit_free(remoteHead);
      git_reference_free(remoteRef);
      git_repository_free(repo);
      SetError(LastGitErrorOr("failed to fast-forward working tree"));
      return;
    }
    std::string localRefName = "refs/heads/" + branch;
    git_reference *localRef = nullptr;
    if (git_reference_lookup(&localRef, repo, localRefName.c_str()) != 0 ||
        git_reference_set_target(&localRef, localRef, targetOid,
                                 "gitbox pull") != 0 ||
        git_repository_set_head(repo, localRefName.c_str()) != 0) {
      if (localRef != nullptr)
        git_reference_free(localRef);
      git_object_free(target);
      git_annotated_commit_free(remoteHead);
      git_reference_free(remoteRef);
      git_repository_free(repo);
      SetError(LastGitErrorOr("failed to update local branch"));
      return;
    }
    git_reference_free(localRef);
    git_object_free(target);
    git_annotated_commit_free(remoteHead);
    git_reference_free(remoteRef);
    git_repository_free(repo);
  }

 private:
  std::string repoPath_;
  std::string remoteName_;
  std::string token_;
  std::string user_;
};

Napi::Value Pull(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "repoPath (string) is required")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string path = info[0].As<Napi::String>().Utf8Value();
  std::string remoteName = "origin";
  if (info.Length() > 1 && info[1].IsString()) {
    remoteName = info[1].As<Napi::String>().Utf8Value();
  }
  std::string token;
  if (info.Length() > 2 && info[2].IsString()) {
    token = info[2].As<Napi::String>().Utf8Value();
  }
  std::string user;
  if (info.Length() > 3 && info[3].IsString()) {
    user = info[3].As<Napi::String>().Utf8Value();
  }
  PullWorker *worker = new PullWorker(env, path, remoteName, token, user);
  Napi::Promise promise = worker->GetPromise();
  worker->Queue();
  return promise;
}

Napi::Value Remotes(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }
  git_strarray remotes = {0};
  if (git_remote_list(&remotes, repo) != 0) {
    git_repository_free(repo);
    return env.Null();
  }
  Napi::Array result = Napi::Array::New(env);
  for (size_t i = 0; i < remotes.count; ++i) {
    result.Set(i, Napi::String::New(env, remotes.strings[i]));
  }
  git_strarray_free(&remotes);
  git_repository_free(repo);
  return result;
}

Napi::Value Tags(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }
  git_strarray tags = {0};
  if (git_tag_list(&tags, repo) != 0) {
    git_repository_free(repo);
    return env.Null();
  }
  Napi::Array result = Napi::Array::New(env);
  for (size_t i = 0; i < tags.count; ++i) {
    Napi::Object item = Napi::Object::New(env);
    item.Set("name", Napi::String::New(env, tags.strings[i]));

    std::string refName = std::string("refs/tags/") + tags.strings[i];
    git_reference *ref = nullptr;
    if (git_reference_lookup(&ref, repo, refName.c_str()) == 0) {
      git_object *targetObj = nullptr;
      if (git_reference_peel(&targetObj, ref, GIT_OBJECT_COMMIT) == 0) {
        const git_oid *oid = git_object_id(targetObj);
        char oidStr[GIT_OID_HEXSZ + 1];
        git_oid_tostr(oidStr, sizeof(oidStr), oid);
        item.Set("target", Napi::String::New(env, oidStr));
        git_object_free(targetObj);
      }
      git_reference_free(ref);
    }

    result.Set(i, item);
  }
  git_strarray_free(&tags);
  git_repository_free(repo);
  return result;
}

struct StashData {
  std::vector<Napi::Object> stashes;
  Napi::Env env;
  git_repository *repo;
};

int StashCallback(size_t index, const char *message, const git_oid *stash_id,
                  void *payload) {
  StashData *data = static_cast<StashData *>(payload);
  Napi::Env env = data->env;
  Napi::Object item = Napi::Object::New(env);
  item.Set("index", Napi::Number::New(env, index));
  item.Set("message", Napi::String::New(env, message ? message : ""));

  char oidStr[GIT_OID_HEXSZ + 1];
  git_oid_tostr(oidStr, sizeof(oidStr), stash_id);
  item.Set("id", Napi::String::New(env, oidStr));

  // NOTE: `payload` is the StashData* we were handed, NOT a git_commit. The
  // previous code cast it to git_commit* and called git_commit_owner() on it,
  // which dereferenced a garbage repository pointer and segfaulted (SIGSEGV)
  // for any repo that actually had stashes. Look the commit up via the real
  // repository handle carried in the payload.
  git_commit *commit = nullptr;
  if (git_commit_lookup(&commit, data->repo, stash_id) == 0) {
    item.Set("timestamp", Napi::Number::New(env, static_cast<double>(
                                                     git_commit_time(commit))));
    git_commit_free(commit);
  } else {
    item.Set("timestamp", Napi::Number::New(env, 0));
  }

  data->stashes.push_back(item);
  return 0;
}

Napi::Value Stashes(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  StashData data{std::vector<Napi::Object>(), env, repo};
  git_stash_foreach(repo, StashCallback, &data);

  Napi::Array result = Napi::Array::New(env);
  for (size_t i = 0; i < data.stashes.size(); i++) {
    result.Set(i, data.stashes[i]);
  }

  git_repository_free(repo);
  return result;
}

// Resolves a stash OID (what the UI carries around) to the index git_stash_pop
// wants. Absent/empty id means the most recent entry.
struct StashIndexLookup {
  std::string wantedOid;
  size_t index = 0;
  bool found = false;
};

int FindStashIndex(size_t index, const char *, const git_oid *stash_id,
                   void *payload) {
  auto *lookup = static_cast<StashIndexLookup *>(payload);
  char oidStr[GIT_OID_HEXSZ + 1];
  git_oid_tostr(oidStr, sizeof(oidStr), stash_id);
  if (lookup->wantedOid == oidStr) {
    lookup->index = index;
    lookup->found = true;
    return 1;  // stop iterating
  }
  return 0;
}

// git_stash_apply leaves the restored changes in the index, so they come back
// staged; `git stash pop` (without --index) brings them back unstaged, which is
// what the Local Changes list is built around. Reset only the paths the stash
// actually carried, so anything staged in the meantime is left alone.
void UnstageStashedPaths(git_repository *repo, size_t stashIndex) {
  struct Finder {
    size_t wanted;
    git_oid oid;
    bool found = false;
  } finder{stashIndex, {}, false};

  git_stash_foreach(
      repo,
      [](size_t index, const char *, const git_oid *oid, void *payload) -> int {
        auto *f = static_cast<Finder *>(payload);
        if (index == f->wanted) {
          git_oid_cpy(&f->oid, oid);
          f->found = true;
          return 1;
        }
        return 0;
      },
      &finder);
  if (!finder.found)
    return;

  git_commit *stashCommit = nullptr;
  if (git_commit_lookup(&stashCommit, repo, &finder.oid) != 0)
    return;
  git_commit *base = nullptr;
  git_tree *stashTree = nullptr;
  git_tree *baseTree = nullptr;
  git_diff *diff = nullptr;
  std::vector<std::string> paths;
  if (git_commit_parent(&base, stashCommit, 0) == 0 &&
      git_commit_tree(&stashTree, stashCommit) == 0 &&
      git_commit_tree(&baseTree, base) == 0 &&
      git_diff_tree_to_tree(&diff, repo, baseTree, stashTree, nullptr) == 0) {
    size_t deltas = git_diff_num_deltas(diff);
    for (size_t i = 0; i < deltas; ++i) {
      const git_diff_delta *delta = git_diff_get_delta(diff, i);
      if (delta != nullptr && delta->new_file.path != nullptr)
        paths.push_back(delta->new_file.path);
    }
  }

  if (!paths.empty()) {
    git_object *head = nullptr;
    if (git_revparse_single(&head, repo, "HEAD^{commit}") == 0) {
      std::vector<char *> raw;
      raw.reserve(paths.size());
      for (auto &p : paths)
        raw.push_back(const_cast<char *>(p.c_str()));
      git_strarray spec = {raw.data(), raw.size()};
      git_reset_default(repo, head, &spec);
      git_object_free(head);
    }
  }

  if (diff != nullptr)
    git_diff_free(diff);
  if (baseTree != nullptr)
    git_tree_free(baseTree);
  if (stashTree != nullptr)
    git_tree_free(stashTree);
  if (base != nullptr)
    git_commit_free(base);
  git_commit_free(stashCommit);
}

// Stash save/pop natively, so the "stash, pull, restore" recovery path works in
// a packaged build — it must not depend on a system `git` GitBox does not ship.
Napi::Value StashSave(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string message;
  if (info.Length() > 1 && info[1].IsString()) {
    message = info[1].As<Napi::String>().Utf8Value();
  }

  git_repository *repo = nullptr;
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_signature *stasher = nullptr;
  if (!SignatureFromConfig(repo, &stasher)) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to build stash signature"), env.Null();
  }

  git_oid out;
  int rc = git_stash_save(&out, repo, stasher,
                          message.empty() ? nullptr : message.c_str(),
                          GIT_STASH_DEFAULT);
  std::string error = rc == 0 ? std::string()
                              : LastGitErrorOr("failed to stash changes");
  git_signature_free(stasher);
  git_repository_free(repo);

  // Nothing to stash is a state, not a failure — the caller decides what it
  // means (for pull-with-autostash it means "just pull").
  if (rc == GIT_ENOTFOUND) {
    return Napi::Boolean::New(env, false);
  }
  if (rc != 0) {
    Napi::Error::New(env, error).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Boolean::New(env, true);
}

Napi::Value StashPop(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string stashId;
  if (info.Length() > 1 && info[1].IsString()) {
    stashId = info[1].As<Napi::String>().Utf8Value();
  }

  git_repository *repo = nullptr;
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  size_t index = 0;
  if (!stashId.empty()) {
    StashIndexLookup lookup{stashId, 0, false};
    git_stash_foreach(repo, FindStashIndex, &lookup);
    if (!lookup.found) {
      git_repository_free(repo);
      Napi::Error::New(env, "stash entry not found: " + stashId)
          .ThrowAsJavaScriptException();
      return env.Null();
    }
    index = lookup.index;
  }

  // Apply and drop separately rather than calling git_stash_pop: libgit2's pop
  // drops the entry even when the apply left conflict markers behind, so the
  // only copy of the user's work would be a half-merged working tree. Git keeps
  // the stash in that case, and so do we.
  git_stash_apply_options opts = GIT_STASH_APPLY_OPTIONS_INIT;
  CheckoutConflicts blocked;
  WatchCheckoutConflicts(&opts.checkout_options, &blocked);
  int rc = git_stash_apply(repo, index, &opts);

  std::string error;
  if (rc != 0) {
    error = LastGitErrorOr("failed to restore stash");
    if (!blocked.paths.empty()) {
      error = "restoring the stash would overwrite local changes to: " +
              JoinPaths(blocked.paths);
    }
    error = WithPermissionHint(
        error, blocked.paths.empty() ? std::string() : blocked.paths[0]);
  } else {
    git_index *repoIndex = nullptr;
    if (git_repository_index(&repoIndex, repo) == 0) {
      if (git_index_has_conflicts(repoIndex)) {
        error =
            "the stash was applied but conflicts with the working tree — "
            "resolve the conflict markers. The stash entry was kept so nothing "
            "is lost.";
      }
      git_index_free(repoIndex);
    }
  }

  if (rc == 0 && error.empty()) {
    UnstageStashedPaths(repo, index);
    git_stash_drop(repo, index);
  }
  git_repository_free(repo);

  if (!error.empty()) {
    Napi::Error::New(env, error).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Boolean::New(env, true);
}

// --force-with-lease: only overwrite the remote branch if it still points where
// our last fetch left it (refs/remotes/<remote>/<branch>). The push_negotiation
// callback runs after libgit2 learns the remote's current tip but before the
// update, so we compare and abort if someone else pushed in the meantime.
// The callback shares opts.callbacks.payload with the credentials callback, so
// the lease data is passed out-of-band via a thread_local (each PushWorker runs
// its push synchronously on one worker thread).
struct LeaseData {
  git_oid expected;
  bool have = false;       // false when we have no remote-tracking ref to lease on
  std::string dstRef;      // "refs/heads/<target>"
  bool violated = false;   // set by the callback when the lease check fails
};
static thread_local LeaseData *tlLease = nullptr;

static int LeaseNegotiationCb(const git_push_update **updates, size_t len,
                              void * /*payload*/) {
  LeaseData *p = tlLease;
  if (p == nullptr)
    return 0;
  for (size_t i = 0; i < len; ++i) {
    if (updates[i]->dst_refname != nullptr && p->dstRef == updates[i]->dst_refname) {
      // Only enforce the lease when we actually have a remote-tracking ref to
      // compare against (otherwise it's a new branch / never fetched — let the
      // force proceed). Abort if the remote's tip differs from our lease.
      if (p->have && git_oid_cmp(&updates[i]->src, &p->expected) != 0) {
        p->violated = true;
        return -1;  // abort the push; Execute() reports the lease violation
      }
    }
  }
  return 0;
}

class PushWorker : public BoolPromiseWorker {
 public:
  PushWorker(Napi::Env env, std::string repoPath, std::string remoteName,
             std::string token, std::string target, bool force, bool pushTags,
             bool setUpstream, bool forceWithLease, std::string user)
      : BoolPromiseWorker(env),
        repoPath_(std::move(repoPath)),
        remoteName_(std::move(remoteName)),
        token_(std::move(token)),
        target_(std::move(target)),
        force_(force),
        pushTags_(pushTags),
        setUpstream_(setUpstream),
        forceWithLease_(forceWithLease),
        user_(std::move(user)) {}

  void Execute() override {
    git_repository *repo = nullptr;
    if (git_repository_open(&repo, repoPath_.c_str()) != 0) {
      SetError(LastGitErrorOr("failed to open repository"));
      return;
    }
    std::string branch = CurrentBranchName(repo);
    if (branch.empty()) {
      git_repository_free(repo);
      SetError("detached HEAD is not supported for push");
      return;
    }
    std::string target = target_.empty() ? branch : target_;

    git_remote *remote = nullptr;
    if (git_remote_lookup(&remote, repo, remoteName_.c_str()) != 0) {
      git_repository_free(repo);
      SetError(LastGitErrorOr("failed to find remote"));
      return;
    }
    // A leading '+' forces the update (moves the ref even when it isn't a
    // fast-forward). Both --force and --force-with-lease need it; lease adds the
    // safety check installed below.
    std::string lead = (force_ || forceWithLease_) ? "+" : "";
    std::string branchSpec =
        lead + "refs/heads/" + branch + ":refs/heads/" + target;
    std::string tagSpec = lead + "refs/tags/*:refs/tags/*";
    std::vector<char *> specs;
    specs.push_back(const_cast<char *>(branchSpec.c_str()));
    if (pushTags_)
      specs.push_back(const_cast<char *>(tagSpec.c_str()));
    git_strarray refspecs{specs.data(), specs.size()};

    git_push_options opts = GIT_PUSH_OPTIONS_INIT;
    SetupAuth(&opts.callbacks, token_, user_);

    // force-with-lease: lease on our remote-tracking ref; the negotiation
    // callback aborts if the remote's actual tip differs (someone pushed).
    LeaseData lease;
    if (forceWithLease_) {
      lease.dstRef = "refs/heads/" + target;
      std::string trackingRef = "refs/remotes/" + remoteName_ + "/" + branch;
      git_reference *tr = nullptr;
      if (git_reference_lookup(&tr, repo, trackingRef.c_str()) == 0) {
        git_reference *resolved = nullptr;
        if (git_reference_resolve(&resolved, tr) == 0) {
          const git_oid *oid = git_reference_target(resolved);
          if (oid != nullptr) {
            git_oid_cpy(&lease.expected, oid);
            lease.have = true;
          }
          git_reference_free(resolved);
        }
        git_reference_free(tr);
      }
      opts.callbacks.push_negotiation = LeaseNegotiationCb;
      tlLease = &lease;
    }

    int pushRc = git_remote_push(remote, &refspecs, &opts);
    tlLease = nullptr;
    if (pushRc != 0) {
      git_remote_free(remote);
      git_repository_free(repo);
      if (forceWithLease_ && lease.violated) {
        SetError(
            "force-with-lease aborted: the remote branch moved since your last "
            "fetch. Fetch and review the new commits before force-pushing.");
      } else {
        SetError(LastGitErrorOr("push failed"));
      }
      return;
    }
    git_remote_free(remote);

    if (setUpstream_) {
      git_reference *localRef = nullptr;
      if (git_branch_lookup(&localRef, repo, branch.c_str(),
                            GIT_BRANCH_LOCAL) == 0) {
        std::string upstream = remoteName_ + "/" + target;
        git_branch_set_upstream(localRef, upstream.c_str());
        git_reference_free(localRef);
      }
    }
    git_repository_free(repo);
  }

 private:
  std::string repoPath_;
  std::string remoteName_;
  std::string token_;
  std::string target_;
  bool force_;
  bool pushTags_;
  bool setUpstream_;
  bool forceWithLease_;
  std::string user_;
};

Napi::Value Push(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "repoPath (string) is required")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string path = info[0].As<Napi::String>().Utf8Value();
  std::string remoteName = "origin";
  if (info.Length() > 1 && info[1].IsString()) {
    remoteName = info[1].As<Napi::String>().Utf8Value();
  }
  std::string token;
  if (info.Length() > 2 && info[2].IsString()) {
    token = info[2].As<Napi::String>().Utf8Value();
  }
  // Optional: [3]=targetBranch, [4]=force, [5]=pushTags, [6]=setUpstream.
  std::string target;
  if (info.Length() > 3 && info[3].IsString()) {
    target = info[3].As<Napi::String>().Utf8Value();
  }
  bool force = info.Length() > 4 && info[4].IsBoolean() &&
               info[4].As<Napi::Boolean>().Value();
  bool pushTags = info.Length() > 5 && info[5].IsBoolean() &&
                  info[5].As<Napi::Boolean>().Value();
  bool setUpstream = info.Length() > 6 && info[6].IsBoolean() &&
                     info[6].As<Napi::Boolean>().Value();
  bool forceWithLease = info.Length() > 7 && info[7].IsBoolean() &&
                        info[7].As<Napi::Boolean>().Value();

  std::string user;
  if (info.Length() > 8 && info[8].IsString()) {
    user = info[8].As<Napi::String>().Utf8Value();
  }
  PushWorker *worker = new PushWorker(env, path, remoteName, token, target,
                                      force, pushTags, setUpstream,
                                      forceWithLease, user);
  Napi::Promise promise = worker->GetPromise();
  worker->Queue();
  return promise;
}

// Native clone over HTTPS (off-thread — clones can take minutes).
class CloneWorker : public BoolPromiseWorker {
 public:
  CloneWorker(Napi::Env env, std::string url, std::string localPath,
              std::string token, std::string user)
      : BoolPromiseWorker(env),
        url_(std::move(url)),
        localPath_(std::move(localPath)),
        token_(std::move(token)),
        user_(std::move(user)) {}

  void Execute() override {
    git_clone_options opts = GIT_CLONE_OPTIONS_INIT;
    SetupAuth(&opts.fetch_opts.callbacks, token_, user_);
    git_repository *repo = nullptr;
    if (git_clone(&repo, url_.c_str(), localPath_.c_str(), &opts) != 0) {
      SetError(LastGitErrorOr("clone failed"));
      return;
    }
    git_repository_free(repo);
  }

 private:
  std::string url_;
  std::string localPath_;
  std::string token_;
  std::string user_;
};

// args: [0]=url, [1]=localPath, [2]=token?, [3]=username?
Napi::Value Clone(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (!EnsureStringArg(info, 0, "url") || !EnsureStringArg(info, 1, "localPath"))
    return env.Null();
  std::string url = info[0].As<Napi::String>().Utf8Value();
  std::string localPath = info[1].As<Napi::String>().Utf8Value();
  std::string token;
  if (info.Length() > 2 && info[2].IsString()) {
    token = info[2].As<Napi::String>().Utf8Value();
  }
  std::string user;
  if (info.Length() > 3 && info[3].IsString()) {
    user = info[3].As<Napi::String>().Utf8Value();
  }
  CloneWorker *worker = new CloneWorker(env, url, localPath, token, user);
  Napi::Promise promise = worker->GetPromise();
  worker->Queue();
  return promise;
}

// Resolve a remote's configured URL natively (used to pick the auth token),
// so we never shell out to `git remote get-url`. args: [0]=repoPath, [1]=name.
Napi::Value RemoteUrl(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  std::string remoteName = "origin";
  if (info.Length() > 1 && info[1].IsString())
    remoteName = info[1].As<Napi::String>().Utf8Value();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo))
    return env.Null();

  git_remote *remote = nullptr;
  if (git_remote_lookup(&remote, repo, remoteName.c_str()) != 0) {
    git_repository_free(repo);
    return Napi::String::New(env, "");
  }
  const char *url = git_remote_url(remote);
  Napi::Value out = Napi::String::New(env, url ? url : "");
  git_remote_free(remote);
  git_repository_free(repo);
  return out;
}

// Point libgit2's TLS trust at a bundled CA file (mbedTLS has no system CA).
Napi::Value SetTlsCertFile(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (!EnsureStringArg(info, 0, "caFile"))
    return env.Null();
  std::string caFile = info[0].As<Napi::String>().Utf8Value();
  int rc = git_libgit2_opts(GIT_OPT_SET_SSL_CERT_LOCATIONS, caFile.c_str(),
                            (const char *)nullptr);
  return Napi::Boolean::New(env, rc == 0);
}

Napi::Value DiffFile(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "filePath"))
    return env.Null();

  git_repository *repo = nullptr;
  std::string repoPath = repoValue.As<Napi::String>().Utf8Value();
  std::string filePath = info[1].As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, repoPath, &repo)) {
    return env.Null();
  }

  std::string original = HeadFileContent(repo, filePath);
  std::string modified = ReadFile(repoPath + "/" + filePath);

  Napi::Object result = Napi::Object::New(env);
  result.Set("path", Napi::String::New(env, filePath));
  result.Set("original", Napi::String::New(env, original));
  result.Set("modified", Napi::String::New(env, modified));

  git_repository_free(repo);
  return result;
}

Napi::Value StashChanges(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "stashId"))
    return env.Null();

  git_repository *repo = nullptr;
  std::string repoPath = repoValue.As<Napi::String>().Utf8Value();
  std::string stashId = info[1].As<Napi::String>().Utf8Value();

  if (!OpenRepoOrThrow(env, repoPath, &repo)) {
    return env.Null();
  }

  git_oid oid;
  if (git_oid_fromstr(&oid, stashId.c_str()) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "invalid stash OID"), env.Null();
  }

  git_commit *stash_commit = nullptr;
  if (git_commit_lookup(&stash_commit, repo, &oid) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "stash commit not found"), env.Null();
  }

  git_commit *parent_commit = nullptr;
  if (git_commit_parent(&parent_commit, stash_commit, 0) != 0) {
    git_commit_free(stash_commit);
    git_repository_free(repo);
    return ThrowGitError(env, "stash parent not found"), env.Null();
  }

  git_tree *stash_tree = nullptr;
  git_commit_tree(&stash_tree, stash_commit);

  git_tree *parent_tree = nullptr;
  git_commit_tree(&parent_tree, parent_commit);

  git_diff *diff = nullptr;
  // Standard stash merge commit (W):
  // - Parent 0: HEAD
  // - Parent 1: Index commit
  // - Parent 2: Untracked commit (optional)

  // Diff W against HEAD to show all stashed worktree changes
  git_diff_tree_to_tree(&diff, repo, parent_tree, stash_tree, nullptr);

  // If there's a 3rd parent (Parent 2), it's the untracked files commit
  if (git_commit_parentcount(stash_commit) >= 3) {
    git_commit *untracked_commit = nullptr;
    if (git_commit_parent(&untracked_commit, stash_commit, 2) == 0) {
      git_tree *untracked_tree = nullptr;
      git_commit_tree(&untracked_tree, untracked_commit);

      git_diff *untracked_diff = nullptr;
      // Diff untracked_tree against empty tree (parent_tree is HEAD, we want
      // untracked so empty->untracked)
      git_diff_tree_to_tree(&untracked_diff, repo, nullptr, untracked_tree,
                            nullptr);

      if (untracked_diff) {
        git_diff_merge(diff, untracked_diff);
        git_diff_free(untracked_diff);
      }
      git_tree_free(untracked_tree);
      git_commit_free(untracked_commit);
    }
  }

  Napi::Array result = Napi::Array::New(env);
  size_t num_deltas = git_diff_num_deltas(diff);
  for (size_t i = 0; i < num_deltas; ++i) {
    const git_diff_delta *delta = git_diff_get_delta(diff, i);
    Napi::Object item = Napi::Object::New(env);
    item.Set("path", Napi::String::New(env, delta->new_file.path));

    std::string statusStr = "modified";
    switch (delta->status) {
    case GIT_DELTA_ADDED:
      statusStr = "added";
      break;
    case GIT_DELTA_DELETED:
      statusStr = "deleted";
      break;
    case GIT_DELTA_UNTRACKED:
      statusStr = "added";
      break; // treat untracked as added in stash view
    case GIT_DELTA_RENAMED:
      statusStr = "renamed";
      break;
    default:
      break;
    }
    item.Set("status", Napi::String::New(env, statusStr));
    result.Set(i, item);
  }

  git_diff_free(diff);
  git_tree_free(parent_tree);
  git_tree_free(stash_tree);
  git_commit_free(parent_commit);
  git_commit_free(stash_commit);
  git_repository_free(repo);
  return result;
}

Napi::Value DiffStashFile(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "stashId"))
    return env.Null();
  if (!EnsureStringArg(info, 2, "filePath"))
    return env.Null();

  git_repository *repo = nullptr;
  std::string repoPath = repoValue.As<Napi::String>().Utf8Value();
  std::string stashId = info[1].As<Napi::String>().Utf8Value();
  std::string filePath = info[2].As<Napi::String>().Utf8Value();

  if (!OpenRepoOrThrow(env, repoPath, &repo)) {
    return env.Null();
  }

  git_oid oid;
  if (git_oid_fromstr(&oid, stashId.c_str()) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "invalid stash OID"), env.Null();
  }
  git_commit *stash_commit = nullptr;
  if (git_commit_lookup(&stash_commit, repo, &oid) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "stash commit not found"), env.Null();
  }

  git_commit *parent_commit = nullptr;
  if (git_commit_parent(&parent_commit, stash_commit, 0) != 0) {
    git_commit_free(stash_commit);
    git_repository_free(repo);
    return ThrowGitError(env, "stash parent not found"), env.Null();
  }

  git_tree *stash_tree = nullptr;
  git_tree *parent_tree = nullptr;
  if (git_commit_tree(&stash_tree, stash_commit) != 0 ||
      git_commit_tree(&parent_tree, parent_commit) != 0) {
    if (stash_tree) git_tree_free(stash_tree);
    git_commit_free(parent_commit);
    git_commit_free(stash_commit);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to read stash trees"), env.Null();
  }

  auto getStrFromTree = [](git_repository *repo, git_tree *tree,
                           const std::string &path) -> std::string {
    git_tree_entry *entry = nullptr;
    if (git_tree_entry_bypath(&entry, tree, path.c_str()) == 0) {
      git_object *obj = nullptr;
      if (git_tree_entry_to_object(&obj, repo, entry) == 0 &&
          git_object_type(obj) == GIT_OBJECT_BLOB) {
        git_blob *blob = (git_blob *)obj;
        const char *content = (const char *)git_blob_rawcontent(blob);
        size_t size = git_blob_rawsize(blob);
        std::string res(content, size);
        git_object_free(obj);
        git_tree_entry_free(entry);
        return res;
      }
      git_tree_entry_free(entry);
    }
    return "";
  };

  std::string original = getStrFromTree(repo, parent_tree, filePath);
  std::string modified = getStrFromTree(repo, stash_tree, filePath);

  Napi::Object result = Napi::Object::New(env);
  result.Set("path", Napi::String::New(env, filePath));
  result.Set("original", Napi::String::New(env, original));
  result.Set("modified", Napi::String::New(env, modified));

  git_tree_free(parent_tree);
  git_tree_free(stash_tree);
  git_commit_free(parent_commit);
  git_commit_free(stash_commit);
  git_repository_free(repo);
  return result;
}

} // namespace

Napi::Value SetConfig(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "name") || !EnsureStringArg(info, 2, "email"))
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string name = info[1].As<Napi::String>().Utf8Value();
  std::string email = info[2].As<Napi::String>().Utf8Value();

  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_config *cfg = nullptr;
  if (git_repository_config(&cfg, repo) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to open config"), env.Null();
  }

  if (git_config_set_string(cfg, "user.name", name.c_str()) != 0 ||
      git_config_set_string(cfg, "user.email", email.c_str()) != 0) {
    git_config_free(cfg);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to set config"), env.Null();
  }

  git_config_free(cfg);
  git_repository_free(repo);
  return Napi::Boolean::New(env, true);
}

// Lists config entries whose name matches a regex, across the whole config
// chain (system + global + repo when a repo path is given). Used to read the
// user's `credential.*` settings so GitBox can reuse credentials they already
// configured for git — without shelling out to the git CLI, which it must not
// require. Multivalued keys (a helper chain is one) come back as repeated
// entries in configuration order, which is the order git itself consults them.
// args: [0]=repoPath (may be '' for global+system only), [1]=regex
// returns: [{ name, value }]
Napi::Value ConfigEntries(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  std::string repoPath;
  if (info.Length() > 0 && info[0].IsString())
    repoPath = info[0].As<Napi::String>().Utf8Value();
  std::string pattern = "^credential\\.";
  if (info.Length() > 1 && info[1].IsString())
    pattern = info[1].As<Napi::String>().Utf8Value();

  git_repository *repo = nullptr;
  git_config *cfg = nullptr;
  bool opened = false;
  if (!repoPath.empty() && git_repository_open(&repo, repoPath.c_str()) == 0) {
    opened = git_repository_config(&cfg, repo) == 0;
  }
  if (!opened) {
    // No repo (or it failed to open): the global/system config still carries
    // the helper configuration, which is where it usually lives.
    if (repo) {
      git_repository_free(repo);
      repo = nullptr;
    }
    if (git_config_open_default(&cfg) != 0)
      return Napi::Array::New(env, 0);
  }

  Napi::Array out = Napi::Array::New(env);
  git_config_iterator *iter = nullptr;
  if (git_config_iterator_glob_new(&iter, cfg, pattern.c_str()) == 0) {
    git_config_entry *entry = nullptr;
    uint32_t i = 0;
    while (git_config_next(&entry, iter) == 0) {
      Napi::Object item = Napi::Object::New(env);
      item.Set("name", Napi::String::New(env, entry->name ? entry->name : ""));
      item.Set("value",
               Napi::String::New(env, entry->value ? entry->value : ""));
      out.Set(i++, item);
    }
    git_config_iterator_free(iter);
  }

  git_config_free(cfg);
  if (repo)
    git_repository_free(repo);
  return out;
}

// Reads a string value from a *live* (non-snapshot) git_config. Plain
// git_config_get_string only works on snapshots, so use the _buf variant.
std::string ConfigGetString(git_config *cfg, const char *key) {
  git_buf buf = GIT_BUF_INIT;
  std::string result;
  if (git_config_get_string_buf(&buf, cfg, key) == 0 && buf.ptr != nullptr) {
    result = buf.ptr;
  }
  git_buf_dispose(&buf);
  return result;
}

std::string GlobalConfigPath() {
  const char *home = getenv("HOME");
  if (home == nullptr)
    home = getenv("USERPROFILE");
  if (home == nullptr)
    return "";
  return std::string(home) + "/.gitconfig";
}

// Reads user.name / user.email from the global (~/.gitconfig) config.
Napi::Value GetGlobalConfig(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::Object result = Napi::Object::New(env);
  result.Set("userName", Napi::String::New(env, ""));
  result.Set("userEmail", Napi::String::New(env, ""));

  std::string path = GlobalConfigPath();
  if (path.empty())
    return result;

  git_config *cfg = nullptr;
  if (git_config_open_ondisk(&cfg, path.c_str()) != 0)
    return result;

  result.Set("userName", Napi::String::New(env, ConfigGetString(cfg, "user.name")));
  result.Set("userEmail", Napi::String::New(env, ConfigGetString(cfg, "user.email")));

  git_config_free(cfg);
  return result;
}

// Writes user.name / user.email to the global (~/.gitconfig) config.
Napi::Value SetGlobalConfig(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (!EnsureStringArg(info, 0, "name") || !EnsureStringArg(info, 1, "email"))
    return env.Null();

  std::string name = info[0].As<Napi::String>().Utf8Value();
  std::string email = info[1].As<Napi::String>().Utf8Value();

  std::string path = GlobalConfigPath();
  if (path.empty())
    return ThrowGitError(env, "could not resolve home directory"), env.Null();

  git_config *cfg = nullptr;
  if (git_config_open_ondisk(&cfg, path.c_str()) != 0)
    return ThrowGitError(env, "failed to open global git config"), env.Null();

  if (git_config_set_string(cfg, "user.name", name.c_str()) != 0 ||
      git_config_set_string(cfg, "user.email", email.c_str()) != 0) {
    git_config_free(cfg);
    return ThrowGitError(env, "failed to set global config"), env.Null();
  }

  git_config_free(cfg);
  return Napi::Boolean::New(env, true);
}

Napi::Value CommitFiles(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "commitId"))
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string commitId = info[1].As<Napi::String>().Utf8Value();

  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_oid oid;
  if (git_oid_fromstr(&oid, commitId.c_str()) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "invalid commit ID"), env.Null();
  }

  git_commit *commit = nullptr;
  if (git_commit_lookup(&commit, repo, &oid) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "commit not found"), env.Null();
  }

  git_tree *tree = nullptr;
  git_commit_tree(&tree, commit);

  git_tree *parentTree = nullptr;
  if (git_commit_parentcount(commit) > 0) {
    git_commit *parent = nullptr;
    git_commit_parent(&parent, commit, 0);
    git_commit_tree(&parentTree, parent);
    git_commit_free(parent);
  }

  git_diff *diff = nullptr;
  git_diff_tree_to_tree(&diff, repo, parentTree, tree, nullptr);

  Napi::Array result = Napi::Array::New(env);
  uint32_t idx = 0;
  size_t num_deltas = git_diff_num_deltas(diff);

  for (size_t i = 0; i < num_deltas; i++) {
    const git_diff_delta *delta = git_diff_get_delta(diff, i);
    Napi::Object item = Napi::Object::New(env);
    item.Set("path", Napi::String::New(env, delta->new_file.path));

    std::string status = "modified";
    if (delta->status == GIT_DELTA_ADDED)
      status = "added";
    else if (delta->status == GIT_DELTA_DELETED)
      status = "deleted";
    else if (delta->status == GIT_DELTA_RENAMED)
      status = "renamed";

    item.Set("status", Napi::String::New(env, status));
    result.Set(idx++, item);
  }

  git_diff_free(diff);
  if (parentTree)
    git_tree_free(parentTree);
  git_tree_free(tree);
  git_commit_free(commit);
  git_repository_free(repo);
  return result;
}

Napi::Value ListFiles(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();

  std::string refName = "HEAD";
  if (info.Length() > 1 && info[1].IsString()) {
    refName = info[1].As<Napi::String>().Utf8Value();
    if (refName.empty())
      refName = "HEAD";
  }

  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_object *obj = nullptr;
  if (git_revparse_single(&obj, repo, refName.c_str()) != 0) {
    git_repository_free(repo);
    return Napi::Array::New(env);
  }

  git_commit *commit = nullptr;
  if (git_object_peel(reinterpret_cast<git_object **>(&commit), obj,
                      GIT_OBJECT_COMMIT) != 0) {
    git_object_free(obj);
    git_repository_free(repo);
    return Napi::Array::New(env);
  }

  git_tree *tree = nullptr;
  git_commit_tree(&tree, commit);

  Napi::Array result = Napi::Array::New(env);
  uint32_t idx = 0;

  struct WalkData {
    Napi::Array arr;
    uint32_t *idxPtr;
    Napi::Env env;
  } data = {result, &idx, env};

  git_tree_walk(
      tree, GIT_TREEWALK_PRE,
      [](const char *root, const git_tree_entry *entry, void *payload) -> int {
        WalkData *d = static_cast<WalkData *>(payload);
        if (git_tree_entry_type(entry) == GIT_OBJECT_BLOB) {
          std::string fullPath = std::string(root) + git_tree_entry_name(entry);
          d->arr.Set((*d->idxPtr)++, Napi::String::New(d->env, fullPath));
        }
        return 0;
      },
      &data);

  git_tree_free(tree);
  git_commit_free(commit);
  git_object_free(obj);
  git_repository_free(repo);
  return result;
}

Napi::Value GetFileContent(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "filePath"))
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string filePath = info[1].As<Napi::String>().Utf8Value();

  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  std::string content = HeadFileContent(repo, filePath);

  git_repository_free(repo);
  return Napi::String::New(env, content);
}

Napi::Value GetConfig(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_config *cfg = nullptr;
  if (git_repository_config(&cfg, repo) != 0) {
    git_repository_free(repo);
    return env.Null();
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("userName", Napi::String::New(env, ConfigGetString(cfg, "user.name")));
  result.Set("userEmail", Napi::String::New(env, ConfigGetString(cfg, "user.email")));

  git_config_free(cfg);
  git_repository_free(repo);
  return result;
}

struct MergeHeadCollect {
  git_repository *repo;
  std::vector<git_commit *> *parents;
};

int CollectMergeHead(const git_oid *oid, void *payload) {
  auto *data = static_cast<MergeHeadCollect *>(payload);
  git_commit *commit = nullptr;
  if (git_commit_lookup(&commit, data->repo, oid) == 0) {
    data->parents->push_back(commit);
  }
  return 0;
}

std::string RepoStateLabel(int state) {
  switch (state) {
  case GIT_REPOSITORY_STATE_MERGE:
    return "merge";
  case GIT_REPOSITORY_STATE_REVERT:
  case GIT_REPOSITORY_STATE_REVERT_SEQUENCE:
    return "revert";
  case GIT_REPOSITORY_STATE_CHERRYPICK:
  case GIT_REPOSITORY_STATE_CHERRYPICK_SEQUENCE:
    return "cherrypick";
  case GIT_REPOSITORY_STATE_BISECT:
    return "bisect";
  case GIT_REPOSITORY_STATE_REBASE:
  case GIT_REPOSITORY_STATE_REBASE_INTERACTIVE:
  case GIT_REPOSITORY_STATE_REBASE_MERGE:
    return "rebase";
  case GIT_REPOSITORY_STATE_APPLY_MAILBOX:
  case GIT_REPOSITORY_STATE_APPLY_MAILBOX_OR_REBASE:
    return "apply_mailbox";
  default:
    return "clean";
  }
}

// --- Rebase control (abort / skip / continue) -------------------------------
// GitBox drives an in-progress rebase via libgit2 so it never shells out to git.

// libgit2 refuses to open interactive / "merge backend" rebases (the git CLI
// default), so git_rebase_abort can't be used. This restores the branch by hand:
// reset it to the pre-rebase HEAD recorded in .git/rebase-merge (or rebase-apply)
// and delete the rebase state directory. Works for every rebase backend.
static bool ManualRebaseAbort(git_repository *repo, std::string *err) {
  namespace fs = std::filesystem;
  std::string gitdir = git_repository_path(repo);  // has a trailing separator
  auto readTrim = [](const std::string &p) -> std::string {
    std::ifstream f(p);
    if (!f) return "";
    std::string s;
    std::getline(f, s);
    while (!s.empty() && (s.back() == '\n' || s.back() == '\r' || s.back() == ' '))
      s.pop_back();
    return s;
  };

  std::string base;
  std::error_code ec;
  if (fs::exists(gitdir + "rebase-merge", ec)) base = gitdir + "rebase-merge/";
  else if (fs::exists(gitdir + "rebase-apply", ec)) base = gitdir + "rebase-apply/";
  else { *err = "no rebase in progress"; return false; }

  std::string origHead = readTrim(base + "orig-head");
  std::string headName = readTrim(base + "head-name");  // refs/heads/… (may be empty)
  if (origHead.empty()) { *err = "cannot find the pre-rebase HEAD"; return false; }

  git_oid oid;
  if (git_oid_fromstr(&oid, origHead.c_str()) != 0) {
    *err = "invalid pre-rebase HEAD"; return false;
  }
  git_object *target = nullptr;
  if (git_object_lookup(&target, repo, &oid, GIT_OBJECT_COMMIT) != 0) {
    *err = LastGitErrorOr("pre-rebase commit not found"); return false;
  }

  // Re-point the original branch at the pre-rebase commit and re-attach HEAD.
  if (!headName.empty()) {
    git_reference *branchRef = nullptr;
    if (git_reference_create(&branchRef, repo, headName.c_str(), &oid, 1,
                             "rebase abort") == 0 && branchRef) {
      git_reference_free(branchRef);
    }
    git_repository_set_head(repo, headName.c_str());
  }

  git_checkout_options coOpts = GIT_CHECKOUT_OPTIONS_INIT;
  coOpts.checkout_strategy = GIT_CHECKOUT_FORCE;
  int rc = git_reset(repo, target, GIT_RESET_HARD, &coOpts);
  git_object_free(target);
  if (rc != 0) { *err = LastGitErrorOr("failed to reset to the pre-rebase HEAD"); return false; }

  fs::remove_all(base, ec);
  git_repository_state_cleanup(repo);
  return true;
}

Napi::Value RebaseAbort(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo))
    return env.Null();

  // Fast path: apply-backend rebases libgit2 can drive.
  git_rebase *rebase = nullptr;
  if (git_rebase_open(&rebase, repo, nullptr) == 0) {
    int rc = git_rebase_abort(rebase);
    git_rebase_free(rebase);
    if (rc == 0) {
      git_repository_free(repo);
      return Napi::Boolean::New(env, true);
    }
    // else fall through to the manual restore.
  }

  // Fallback for interactive / merge-backend rebases libgit2 won't open.
  std::string err;
  bool ok = ManualRebaseAbort(repo, &err);
  git_repository_free(repo);
  if (!ok) {
    Napi::Error::New(env, err).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Boolean::New(env, true);
}

// Drive the rebase forward. `skipCurrent` drops the stopped patch (git rebase
// --skip); otherwise it commits the resolved patch and continues (--continue).
// Stops at the next conflict for the user to resolve; finalizes when all
// operations are applied cleanly. Returns { done, conflicts }.
static Napi::Value RebaseAdvance(const Napi::CallbackInfo &info,
                                 bool skipCurrent) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo))
    return env.Null();

  git_rebase *rebase = nullptr;
  if (git_rebase_open(&rebase, repo, nullptr) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "no rebase in progress"), env.Null();
  }
  git_signature *sig = nullptr;
  if (!SignatureFromConfig(repo, &sig)) {
    git_rebase_free(rebase);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to build committer signature"),
           env.Null();
  }

  auto hasConflicts = [&]() -> bool {
    git_index *idx = nullptr;
    if (git_repository_index(&idx, repo) != 0)
      return false;
    bool c = git_index_has_conflicts(idx) != 0;
    git_index_free(idx);
    return c;
  };

  // Continue: commit the current (resolved) operation first. Skip: leave it.
  if (!skipCurrent) {
    if (hasConflicts()) {
      git_signature_free(sig);
      git_rebase_free(rebase);
      git_repository_free(repo);
      Napi::Error::New(env, "resolve the remaining conflicts first")
          .ThrowAsJavaScriptException();
      return env.Null();
    }
    git_oid cid;
    int rc = git_rebase_commit(&cid, rebase, nullptr, sig, nullptr, nullptr);
    // GIT_EAPPLIED: nothing to commit (empty patch) — fine, keep going.
    if (rc != 0 && rc != GIT_EAPPLIED) {
      git_signature_free(sig);
      git_rebase_free(rebase);
      git_repository_free(repo);
      return ThrowGitError(env, "failed to continue rebase"), env.Null();
    }
  }

  bool stoppedAtConflict = false;
  while (true) {
    git_rebase_operation *op = nullptr;
    int rc = git_rebase_next(&op, rebase);
    if (rc == GIT_ITEROVER)
      break;
    if (rc != 0) {
      git_signature_free(sig);
      git_rebase_free(rebase);
      git_repository_free(repo);
      return ThrowGitError(env, "rebase step failed"), env.Null();
    }
    if (hasConflicts()) {
      stoppedAtConflict = true;
      break;  // hand control back to the user
    }
    git_oid cid;
    int crc = git_rebase_commit(&cid, rebase, nullptr, sig, nullptr, nullptr);
    if (crc != 0 && crc != GIT_EAPPLIED) {
      git_signature_free(sig);
      git_rebase_free(rebase);
      git_repository_free(repo);
      return ThrowGitError(env, "failed to commit rebased change"), env.Null();
    }
  }

  bool done = false;
  if (!stoppedAtConflict) {
    if (git_rebase_finish(rebase, sig) != 0) {
      git_signature_free(sig);
      git_rebase_free(rebase);
      git_repository_free(repo);
      return ThrowGitError(env, "failed to finish rebase"), env.Null();
    }
    done = true;
  }

  git_signature_free(sig);
  git_rebase_free(rebase);
  git_repository_free(repo);

  Napi::Object result = Napi::Object::New(env);
  result.Set("done", Napi::Boolean::New(env, done));
  result.Set("conflicts", Napi::Boolean::New(env, stoppedAtConflict));
  return result;
}

Napi::Value RebaseSkip(const Napi::CallbackInfo &info) {
  return RebaseAdvance(info, true);
}
Napi::Value RebaseContinue(const Napi::CallbackInfo &info) {
  return RebaseAdvance(info, false);
}

// pull --rebase: replay the current branch's commits onto `upstream` (typically
// a remote-tracking ref like "origin/main"). Starts the rebase (git_rebase_init)
// and drives it like RebaseAdvance; stops at the first conflict so the existing
// rebaseContinue / rebaseSkip / rebaseAbort flow can finish it. The caller must
// have fetched first so the remote-tracking ref is current.
// Returns { status: "rebased" | "conflicts", done }.
Napi::Value RebaseOnto(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "upstream"))
    return env.Null();
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string upstreamName = info[1].As<Napi::String>().Utf8Value();

  git_repository *repo = nullptr;
  if (!OpenRepoOrThrow(env, path, &repo))
    return env.Null();

  // Resolve the upstream (remote-tracking first, then a local branch).
  git_reference *upstreamRef = nullptr;
  if (git_branch_lookup(&upstreamRef, repo, upstreamName.c_str(),
                        GIT_BRANCH_REMOTE) != 0 &&
      git_branch_lookup(&upstreamRef, repo, upstreamName.c_str(),
                        GIT_BRANCH_LOCAL) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to find upstream to rebase onto"),
           env.Null();
  }
  git_annotated_commit *upstream = nullptr;
  if (git_annotated_commit_from_ref(&upstream, repo, upstreamRef) != 0) {
    git_reference_free(upstreamRef);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to read upstream head"), env.Null();
  }

  git_rebase *rebase = nullptr;
  git_rebase_options ropts = GIT_REBASE_OPTIONS_INIT;
  int rc = git_rebase_init(&rebase, repo, nullptr /* branch = HEAD */, upstream,
                           nullptr /* onto == upstream */, &ropts);
  git_annotated_commit_free(upstream);
  git_reference_free(upstreamRef);
  if (rc != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to start rebase"), env.Null();
  }

  git_signature *sig = nullptr;
  if (!SignatureFromConfig(repo, &sig)) {
    git_rebase_free(rebase);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to build committer signature"), env.Null();
  }

  auto hasConflicts = [&]() -> bool {
    git_index *idx = nullptr;
    if (git_repository_index(&idx, repo) != 0)
      return false;
    bool c = git_index_has_conflicts(idx) != 0;
    git_index_free(idx);
    return c;
  };

  bool stoppedAtConflict = false;
  while (true) {
    git_rebase_operation *op = nullptr;
    int nrc = git_rebase_next(&op, rebase);
    if (nrc == GIT_ITEROVER)
      break;
    if (nrc != 0) {
      git_signature_free(sig);
      git_rebase_free(rebase);
      git_repository_free(repo);
      return ThrowGitError(env, "rebase step failed"), env.Null();
    }
    if (hasConflicts()) {
      stoppedAtConflict = true;
      break;  // hand control back to the user (rebaseContinue/Skip/Abort)
    }
    git_oid cid;
    int crc = git_rebase_commit(&cid, rebase, nullptr, sig, nullptr, nullptr);
    if (crc != 0 && crc != GIT_EAPPLIED) {
      git_signature_free(sig);
      git_rebase_free(rebase);
      git_repository_free(repo);
      return ThrowGitError(env, "failed to commit rebased change"), env.Null();
    }
  }

  bool done = false;
  if (!stoppedAtConflict) {
    if (git_rebase_finish(rebase, sig) != 0) {
      git_signature_free(sig);
      git_rebase_free(rebase);
      git_repository_free(repo);
      return ThrowGitError(env, "failed to finish rebase"), env.Null();
    }
    done = true;
  }

  git_signature_free(sig);
  git_rebase_free(rebase);
  git_repository_free(repo);

  Napi::Object result = Napi::Object::New(env);
  result.Set("status",
             Napi::String::New(env, stoppedAtConflict ? "conflicts" : "rebased"));
  result.Set("done", Napi::Boolean::New(env, done));
  return result;
}

Napi::Array CollectConflictPaths(Napi::Env env, git_index *index) {
  Napi::Array arr = Napi::Array::New(env);
  git_index_conflict_iterator *it = nullptr;
  if (git_index_conflict_iterator_new(&it, index) != 0) {
    return arr;
  }
  const git_index_entry *ancestor = nullptr;
  const git_index_entry *our = nullptr;
  const git_index_entry *their = nullptr;
  uint32_t i = 0;
  while (git_index_conflict_next(&ancestor, &our, &their, it) == 0) {
    const char *p = their != nullptr
                        ? their->path
                        : (our != nullptr ? our->path
                                          : (ancestor != nullptr ? ancestor->path
                                                                 : nullptr));
    if (p != nullptr) {
      arr.Set(i++, Napi::String::New(env, p));
    }
  }
  git_index_conflict_iterator_free(it);
  return arr;
}

Napi::Value RepoState(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  int state = git_repository_state(repo);
  git_repository_free(repo);
  return Napi::String::New(env, RepoStateLabel(state));
}

Napi::Value MergeBranch(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "branchName"))
    return env.Null();

  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string branchName = info[1].As<Napi::String>().Utf8Value();
  bool noFastForward = info.Length() > 2 && info[2].IsBoolean() &&
                       info[2].As<Napi::Boolean>().Value();

  git_repository *repo = nullptr;
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_reference *branchRef = nullptr;
  if (git_branch_lookup(&branchRef, repo, branchName.c_str(),
                        GIT_BRANCH_LOCAL) != 0 &&
      git_branch_lookup(&branchRef, repo, branchName.c_str(),
                        GIT_BRANCH_REMOTE) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to find branch to merge"), env.Null();
  }

  git_annotated_commit *theirHead = nullptr;
  if (git_annotated_commit_from_ref(&theirHead, repo, branchRef) != 0) {
    git_reference_free(branchRef);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to read branch head"), env.Null();
  }

  const git_annotated_commit *heads[] = {theirHead};
  git_merge_analysis_t analysis;
  git_merge_preference_t pref;
  if (git_merge_analysis(&analysis, &pref, repo, heads, 1) != 0) {
    git_annotated_commit_free(theirHead);
    git_reference_free(branchRef);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to analyze merge"), env.Null();
  }

  Napi::Object result = Napi::Object::New(env);

  if (analysis & GIT_MERGE_ANALYSIS_UP_TO_DATE) {
    git_annotated_commit_free(theirHead);
    git_reference_free(branchRef);
    git_repository_free(repo);
    result.Set("status", Napi::String::New(env, "up_to_date"));
    return result;
  }

  if ((analysis & GIT_MERGE_ANALYSIS_FASTFORWARD) && !noFastForward) {
    const git_oid *targetOid = git_annotated_commit_id(theirHead);
    git_object *target = nullptr;
    if (git_object_lookup(&target, repo, targetOid, GIT_OBJECT_COMMIT) != 0) {
      git_annotated_commit_free(theirHead);
      git_reference_free(branchRef);
      git_repository_free(repo);
      return ThrowGitError(env, "failed to lookup target commit"), env.Null();
    }

    git_checkout_options coOpts = GIT_CHECKOUT_OPTIONS_INIT;
    coOpts.checkout_strategy = GIT_CHECKOUT_SAFE;
    git_reference *headRef = nullptr;
    git_reference *newHead = nullptr;
    if (git_checkout_tree(repo, target, &coOpts) != 0 ||
        git_repository_head(&headRef, repo) != 0 ||
        git_reference_set_target(&newHead, headRef, targetOid,
                                 "gitbox merge (fast-forward)") != 0) {
      if (headRef != nullptr)
        git_reference_free(headRef);
      git_object_free(target);
      git_annotated_commit_free(theirHead);
      git_reference_free(branchRef);
      git_repository_free(repo);
      return ThrowGitError(env, "failed to fast-forward"), env.Null();
    }

    char oidStr[GIT_OID_HEXSZ + 1];
    git_oid_tostr(oidStr, sizeof(oidStr), targetOid);

    if (newHead != nullptr)
      git_reference_free(newHead);
    git_reference_free(headRef);
    git_object_free(target);
    git_annotated_commit_free(theirHead);
    git_reference_free(branchRef);
    git_repository_free(repo);
    result.Set("status", Napi::String::New(env, "fast_forward"));
    result.Set("commit", Napi::String::New(env, oidStr));
    return result;
  }

  git_merge_options mergeOpts = GIT_MERGE_OPTIONS_INIT;
  git_checkout_options coOpts = GIT_CHECKOUT_OPTIONS_INIT;
  coOpts.checkout_strategy = GIT_CHECKOUT_SAFE | GIT_CHECKOUT_ALLOW_CONFLICTS;
  if (git_merge(repo, heads, 1, &mergeOpts, &coOpts) != 0) {
    git_annotated_commit_free(theirHead);
    git_reference_free(branchRef);
    git_repository_free(repo);
    return ThrowGitError(env, "merge failed"), env.Null();
  }

  git_index *index = nullptr;
  if (git_repository_index(&index, repo) != 0) {
    git_annotated_commit_free(theirHead);
    git_reference_free(branchRef);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to open index after merge"), env.Null();
  }

  if (git_index_has_conflicts(index)) {
    Napi::Array conflicts = CollectConflictPaths(env, index);
    git_index_free(index);
    git_annotated_commit_free(theirHead);
    git_reference_free(branchRef);
    git_repository_free(repo);
    result.Set("status", Napi::String::New(env, "conflicts"));
    result.Set("conflicts", conflicts);
    return result;
  }

  git_oid treeOid;
  git_tree *tree = nullptr;
  git_signature *sig = nullptr;
  git_reference *headRef = nullptr;
  git_commit *headCommit = nullptr;
  git_commit *theirCommit = nullptr;

  if (git_index_write_tree(&treeOid, index) != 0 ||
      git_index_write(index) != 0 ||
      git_tree_lookup(&tree, repo, &treeOid) != 0 ||
      !SignatureFromConfig(repo, &sig) ||
      git_repository_head(&headRef, repo) != 0 ||
      git_commit_lookup(&headCommit, repo, git_reference_target(headRef)) != 0 ||
      git_commit_lookup(&theirCommit, repo,
                        git_annotated_commit_id(theirHead)) != 0) {
    if (theirCommit != nullptr)
      git_commit_free(theirCommit);
    if (headCommit != nullptr)
      git_commit_free(headCommit);
    if (headRef != nullptr)
      git_reference_free(headRef);
    if (sig != nullptr)
      git_signature_free(sig);
    if (tree != nullptr)
      git_tree_free(tree);
    git_index_free(index);
    git_annotated_commit_free(theirHead);
    git_reference_free(branchRef);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to prepare merge commit"), env.Null();
  }

  std::string msg = "Merge branch '" + branchName + "'";
  const git_commit *parents[] = {headCommit, theirCommit};
  git_oid commitOid;
  int rc = git_commit_create(&commitOid, repo, "HEAD", sig, sig, nullptr,
                             msg.c_str(), tree, 2, parents);

  git_commit_free(theirCommit);
  git_commit_free(headCommit);
  git_reference_free(headRef);
  git_signature_free(sig);
  git_tree_free(tree);
  git_index_free(index);
  git_annotated_commit_free(theirHead);
  git_reference_free(branchRef);

  if (rc != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to create merge commit"), env.Null();
  }

  git_repository_state_cleanup(repo);

  char oidStr[GIT_OID_HEXSZ + 1];
  git_oid_tostr(oidStr, sizeof(oidStr), &commitOid);
  git_repository_free(repo);
  result.Set("status", Napi::String::New(env, "merged"));
  result.Set("commit", Napi::String::New(env, oidStr));
  return result;
}

Napi::Value MergeContinue(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string message;
  if (info.Length() > 1 && info[1].IsString()) {
    message = info[1].As<Napi::String>().Utf8Value();
  }

  git_repository *repo = nullptr;
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  if (git_repository_state(repo) != GIT_REPOSITORY_STATE_MERGE) {
    git_repository_free(repo);
    return ThrowGitError(env, "repository is not in a merging state"),
           env.Null();
  }

  git_index *index = nullptr;
  if (git_repository_index(&index, repo) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to open index"), env.Null();
  }

  if (git_index_has_conflicts(index)) {
    git_index_free(index);
    git_repository_free(repo);
    return ThrowGitError(env,
                         "resolve all conflicts before completing the merge"),
           env.Null();
  }

  git_oid treeOid;
  git_tree *tree = nullptr;
  if (git_index_write_tree(&treeOid, index) != 0 ||
      git_index_write(index) != 0 ||
      git_tree_lookup(&tree, repo, &treeOid) != 0) {
    git_index_free(index);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to write merged tree"), env.Null();
  }

  git_signature *sig = nullptr;
  if (!SignatureFromConfig(repo, &sig)) {
    git_tree_free(tree);
    git_index_free(index);
    git_repository_free(repo);
    return ThrowGitError(env, "failed to create signature"), env.Null();
  }

  std::vector<git_commit *> parents;
  git_reference *headRef = nullptr;
  git_commit *headCommit = nullptr;
  if (git_repository_head(&headRef, repo) == 0 &&
      git_commit_lookup(&headCommit, repo, git_reference_target(headRef)) == 0) {
    parents.push_back(headCommit);
  }

  MergeHeadCollect collect{repo, &parents};
  git_repository_mergehead_foreach(repo, CollectMergeHead, &collect);

  std::vector<const git_commit *> cparents;
  cparents.reserve(parents.size());
  for (auto *c : parents)
    cparents.push_back(c);

  std::string msg = message.empty() ? "Merge" : message;
  git_oid commitOid;
  int rc = git_commit_create(
      &commitOid, repo, "HEAD", sig, sig, nullptr, msg.c_str(), tree,
      static_cast<int>(cparents.size()),
      cparents.empty() ? nullptr : cparents.data());

  for (auto *c : parents)
    git_commit_free(c);
  if (headRef != nullptr)
    git_reference_free(headRef);
  git_signature_free(sig);
  git_tree_free(tree);
  git_index_free(index);

  if (rc != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to create merge commit"), env.Null();
  }

  git_repository_state_cleanup(repo);

  char oidStr[GIT_OID_HEXSZ + 1];
  git_oid_tostr(oidStr, sizeof(oidStr), &commitOid);
  git_repository_free(repo);
  return Napi::String::New(env, oidStr);
}

Napi::Value MergeAbort(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  std::string path = repoValue.As<Napi::String>().Utf8Value();
  git_repository *repo = nullptr;
  if (!OpenRepoOrThrow(env, path, &repo)) {
    return env.Null();
  }

  git_object *headCommit = nullptr;
  if (git_revparse_single(&headCommit, repo, "HEAD") != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to resolve HEAD"), env.Null();
  }

  git_checkout_options coOpts = GIT_CHECKOUT_OPTIONS_INIT;
  coOpts.checkout_strategy = GIT_CHECKOUT_FORCE;
  int rc = git_reset(repo, headCommit, GIT_RESET_HARD, &coOpts);
  git_object_free(headCommit);

  if (rc != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to abort merge"), env.Null();
  }

  git_repository_state_cleanup(repo);
  git_repository_free(repo);
  return Napi::Boolean::New(env, true);
}

// Initialize a new repository natively. args: [0]=path, [1]=defaultBranch?
Napi::Value InitRepo(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (!EnsureStringArg(info, 0, "path"))
    return env.Null();
  std::string path = info[0].As<Napi::String>().Utf8Value();
  std::string head;
  if (info.Length() > 1 && info[1].IsString())
    head = info[1].As<Napi::String>().Utf8Value();

  git_repository_init_options opts = GIT_REPOSITORY_INIT_OPTIONS_INIT;
  opts.flags = GIT_REPOSITORY_INIT_MKPATH;
  if (!head.empty())
    opts.initial_head = head.c_str();

  git_repository *repo = nullptr;
  if (git_repository_init_ext(&repo, path.c_str(), &opts) != 0)
    return ThrowGitError(env, "init failed"), env.Null();
  git_repository_free(repo);
  return Napi::Boolean::New(env, true);
}

// Two-letter porcelain code for a conflict, derived from which index stages
// exist: 1=ancestor, 2=ours, 3=theirs.
static const char *ConflictCode(bool a, bool o, bool t) {
  if (!a && o && t) return "AA";  // both added
  if (a && o && t) return "UU";   // both modified
  if (!a && o && !t) return "AU"; // added by us
  if (!a && !o && t) return "UA"; // added by them
  if (a && o && !t) return "UD";  // deleted by them
  if (a && !o && t) return "DU";  // deleted by us
  return "DD";                    // both deleted
}

// List conflicted paths with their porcelain code, from the index (no git CLI).
Napi::Value ConflictedFiles(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo))
    return env.Null();

  git_index *idx = nullptr;
  if (git_repository_index(&idx, repo) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to read index"), env.Null();
  }

  Napi::Array arr = Napi::Array::New(env);
  git_index_conflict_iterator *it = nullptr;
  if (git_index_conflict_iterator_new(&it, idx) == 0) {
    const git_index_entry *anc, *our, *their;
    uint32_t i = 0;
    while (git_index_conflict_next(&anc, &our, &their, it) == 0) {
      const char *p = our ? our->path : (their ? their->path : (anc ? anc->path : ""));
      Napi::Object obj = Napi::Object::New(env);
      obj.Set("path", Napi::String::New(env, p ? p : ""));
      obj.Set("code", Napi::String::New(env, ConflictCode(anc, our, their)));
      arr.Set(i++, obj);
    }
    git_index_conflict_iterator_free(it);
  }
  git_index_free(idx);
  git_repository_free(repo);
  return arr;
}

// Resolve one conflicted file by taking a whole side. args:
// [0]=repoPath, [1]=filePath, [2]=side ('ours'|'theirs'|'both').
Napi::Value ResolveConflict(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "filePath") || !EnsureStringArg(info, 2, "side"))
    return env.Null();
  std::string repoPath = repoValue.As<Napi::String>().Utf8Value();
  std::string filePath = info[1].As<Napi::String>().Utf8Value();
  std::string side = info[2].As<Napi::String>().Utf8Value();

  git_repository *repo = nullptr;
  if (!OpenRepoOrThrow(env, repoPath, &repo))
    return env.Null();
  const char *wd = git_repository_workdir(repo);
  if (!wd) {
    git_repository_free(repo);
    return ThrowGitError(env, "bare repo has no working tree"), env.Null();
  }
  std::string full = std::string(wd) + filePath;

  git_index *idx = nullptr;
  if (git_repository_index(&idx, repo) != 0) {
    git_repository_free(repo);
    return ThrowGitError(env, "failed to read index"), env.Null();
  }

  const git_index_entry *anc = nullptr, *our = nullptr, *their = nullptr;
  if (git_index_conflict_get(&anc, &our, &their, idx, filePath.c_str()) != 0) {
    git_index_free(idx);
    git_repository_free(repo);
    return ThrowGitError(env, "not a conflicted path"), env.Null();
  }

  auto blobText = [&](const git_index_entry *e, std::string &out) -> bool {
    git_blob *b = nullptr;
    if (git_blob_lookup(&b, repo, &e->id) != 0)
      return false;
    out.assign(static_cast<const char *>(git_blob_rawcontent(b)),
               static_cast<size_t>(git_blob_rawsize(b)));
    git_blob_free(b);
    return true;
  };
  auto writeFile = [&](const std::string &content) {
    std::ofstream f(full, std::ios::binary | std::ios::trunc);
    f.write(content.data(), static_cast<std::streamsize>(content.size()));
  };

  bool ok = true;
  const git_index_entry *pick =
      (side == "ours") ? our : (side == "theirs") ? their : nullptr;

  if (side == "both") {
    std::string a, b, merged;
    if (our && blobText(our, a)) {
      while (!a.empty() && a.back() == '\n')
        a.pop_back();
      merged += a;
    }
    if (their && blobText(their, b)) {
      if (!merged.empty())
        merged += "\n";
      merged += b;
    }
    merged += "\n";
    writeFile(merged);
    ok = git_index_add_bypath(idx, filePath.c_str()) == 0;
  } else if (pick) {
    std::string content;
    if (!blobText(pick, content)) {
      ok = false;
    } else {
      writeFile(content);
      ok = git_index_add_bypath(idx, filePath.c_str()) == 0;
    }
  } else {
    // Chosen side deleted the file: remove it and stage the deletion.
    std::remove(full.c_str());
    git_index_conflict_remove(idx, filePath.c_str());
    ok = git_index_remove_bypath(idx, filePath.c_str()) == 0 || true;
  }

  if (ok)
    ok = git_index_write(idx) == 0;
  git_index_free(idx);
  git_repository_free(repo);
  if (!ok)
    return ThrowGitError(env, "resolve failed"), env.Null();
  return Napi::Boolean::New(env, true);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  git_libgit2_init();
  exports.Set("getConfig", Napi::Function::New(env, GetConfig));
  exports.Set("setConfig", Napi::Function::New(env, SetConfig));
  exports.Set("getGlobalConfig", Napi::Function::New(env, GetGlobalConfig));
  exports.Set("setGlobalConfig", Napi::Function::New(env, SetGlobalConfig));
  exports.Set("status", Napi::Function::New(env, Status));
  exports.Set("branches", Napi::Function::New(env, Branches));
  exports.Set("remotes", Napi::Function::New(env, Remotes));
  exports.Set("tags", Napi::Function::New(env, Tags));
  exports.Set("stashes", Napi::Function::New(env, Stashes));
  exports.Set("stashSave", Napi::Function::New(env, StashSave));
  exports.Set("stashPop", Napi::Function::New(env, StashPop));
  exports.Set("log", Napi::Function::New(env, Log));
  exports.Set("stageAll", Napi::Function::New(env, StageAll));
  exports.Set("unstageAll", Napi::Function::New(env, UnstageAll));
  exports.Set("discardAll", Napi::Function::New(env, DiscardAll));
  exports.Set("discardFile", Napi::Function::New(env, DiscardFile));
  exports.Set("commitAll", Napi::Function::New(env, CommitAll));
  exports.Set("commitFiles", Napi::Function::New(env, CommitFiles));
  exports.Set("checkoutBranch", Napi::Function::New(env, CheckoutBranch));
  exports.Set("fetch", Napi::Function::New(env, Fetch));
  exports.Set("testCredentials", Napi::Function::New(env, TestCredentials));
  exports.Set("pull", Napi::Function::New(env, Pull));
  exports.Set("push", Napi::Function::New(env, Push));
  exports.Set("clone", Napi::Function::New(env, Clone));
  exports.Set("remoteUrl", Napi::Function::New(env, RemoteUrl));
  exports.Set("configEntries", Napi::Function::New(env, ConfigEntries));
  exports.Set("setTlsCertFile", Napi::Function::New(env, SetTlsCertFile));
  exports.Set("initRepo", Napi::Function::New(env, InitRepo));
  exports.Set("conflictedFiles", Napi::Function::New(env, ConflictedFiles));
  exports.Set("resolveConflict", Napi::Function::New(env, ResolveConflict));
  exports.Set("mergeBranch", Napi::Function::New(env, MergeBranch));
  exports.Set("mergeContinue", Napi::Function::New(env, MergeContinue));
  exports.Set("mergeAbort", Napi::Function::New(env, MergeAbort));
  exports.Set("rebaseAbort", Napi::Function::New(env, RebaseAbort));
  exports.Set("rebaseSkip", Napi::Function::New(env, RebaseSkip));
  exports.Set("rebaseContinue", Napi::Function::New(env, RebaseContinue));
  exports.Set("rebaseOnto", Napi::Function::New(env, RebaseOnto));
  exports.Set("repoState", Napi::Function::New(env, RepoState));
  exports.Set("diffFile", Napi::Function::New(env, DiffFile));
  exports.Set("stashChanges", Napi::Function::New(env, StashChanges));
  exports.Set("diffStashFile", Napi::Function::New(env, DiffStashFile));
  exports.Set("listFiles", Napi::Function::New(env, ListFiles));
  exports.Set("getFileContent", Napi::Function::New(env, GetFileContent));
  return exports;
}

NODE_API_MODULE(gitbox_addon, Init)
