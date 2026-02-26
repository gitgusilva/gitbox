#include <fstream>
#include <git2.h>
#include <napi.h>
#include <sstream>
#include <string>
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

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
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
    git_libgit2_shutdown();
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
  git_libgit2_shutdown();
  return result;
}

Napi::Value Branches(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_branch_iterator *it = nullptr;
  if (git_branch_iterator_new(&it, repo, GIT_BRANCH_ALL) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
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
      git_libgit2_shutdown();
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
  git_libgit2_shutdown();
  return result;
}

Napi::Value Log(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
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

  git_revwalk *walk = nullptr;
  if (git_revwalk_new(&walk, repo) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    Napi::Error::New(env, LastGitErrorOr("failed to create revwalk"))
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  git_revwalk_sorting(walk, GIT_SORT_TIME);

  if (refName == "ALL") {
    git_revwalk_push_glob(walk, "refs/heads/*");
    git_revwalk_push_glob(walk, "refs/remotes/*");
    git_revwalk_push_glob(walk, "refs/tags/*");
    git_revwalk_push_head(walk);
  } else if (refName.empty()) {
    if (git_revwalk_push_head(walk) != 0) {
      git_revwalk_free(walk);
      git_repository_free(repo);
      git_libgit2_shutdown();
      Napi::Error::New(env, LastGitErrorOr("failed to walk HEAD"))
          .ThrowAsJavaScriptException();
      return env.Null();
    }
  } else {
    git_object *obj = nullptr;
    if (git_revparse_single(&obj, repo, refName.c_str()) == 0) {
      git_revwalk_push(walk, git_object_id(obj));
      git_object_free(obj);
    } else {
      git_revwalk_push_head(walk);
    }
  }

  Napi::Array result = Napi::Array::New(env);
  uint32_t idx = 0;
  git_oid oid;
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

        Napi::Object pItem = Napi::Object::New(env);
        pItem.Set("id", Napi::String::New(env, pOidStr));
        pItem.Set("summary",
                  Napi::String::New(env, pSummary != nullptr ? pSummary
                                                             : "(no message)"));
        pItem.Set("author", Napi::String::New(env, pAuthor));
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
  git_libgit2_shutdown();
  return result;
}

Napi::Value StageAll(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_index *index = nullptr;
  if (git_repository_index(&index, repo) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to open index"), env.Null();
  }

  git_strarray pathspec = {nullptr, 0};
  if (git_index_add_all(index, &pathspec, GIT_INDEX_ADD_DEFAULT, nullptr,
                        nullptr) != 0 ||
      git_index_write(index) != 0) {
    git_index_free(index);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to stage files"), env.Null();
  }

  git_index_free(index);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return Napi::Boolean::New(env, true);
}

Napi::Value UnstageAll(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_object *headTarget = nullptr;
  if (git_revparse_single(&headTarget, repo, "HEAD^{tree}") != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to resolve HEAD tree"), env.Null();
  }

  git_index *index = nullptr;
  if (git_repository_index(&index, repo) != 0) {
    git_object_free(headTarget);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to open index"), env.Null();
  }

  if (git_index_read_tree(index, reinterpret_cast<git_tree *>(headTarget)) !=
          0 ||
      git_index_write(index) != 0) {
    git_index_free(index);
    git_object_free(headTarget);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to unstage files"), env.Null();
  }

  git_index_free(index);
  git_object_free(headTarget);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return Napi::Boolean::New(env, true);
}

Napi::Value DiscardAll(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_object *target = nullptr;
  if (git_revparse_single(&target, repo, "HEAD^{tree}") != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to resolve HEAD tree"), env.Null();
  }

  git_checkout_options opts = GIT_CHECKOUT_OPTIONS_INIT;
  opts.checkout_strategy = GIT_CHECKOUT_FORCE | GIT_CHECKOUT_RECREATE_MISSING;
  if (git_checkout_tree(repo, target, &opts) != 0) {
    git_object_free(target);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to discard changes"), env.Null();
  }

  git_object_free(target);
  git_repository_free(repo);
  git_libgit2_shutdown();
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

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_index *index = nullptr;
  if (git_repository_index(&index, repo) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to open index"), env.Null();
  }

  git_oid treeOid;
  if (git_index_write_tree(&treeOid, index) != 0 ||
      git_index_write(index) != 0) {
    git_index_free(index);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to write tree"), env.Null();
  }

  git_tree *tree = nullptr;
  if (git_tree_lookup(&tree, repo, &treeOid) != 0) {
    git_index_free(index);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to lookup tree"), env.Null();
  }

  git_signature *sig = nullptr;
  if (!SignatureFromConfig(repo, &sig)) {
    git_tree_free(tree);
    git_index_free(index);
    git_repository_free(repo);
    git_libgit2_shutdown();
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
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to create commit"), env.Null();
  }

  char oidStr[GIT_OID_HEXSZ + 1];
  git_oid_tostr(oidStr, sizeof(oidStr), &commitOid);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return Napi::String::New(env, oidStr);
}

Napi::Value CheckoutBranch(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "branchName"))
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  std::string branchName = info[1].As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_reference *branchRef = nullptr;
  if (git_branch_lookup(&branchRef, repo, branchName.c_str(),
                        GIT_BRANCH_LOCAL) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to find branch"), env.Null();
  }

  git_object *target = nullptr;
  if (git_reference_peel(&target, branchRef, GIT_OBJECT_COMMIT) != 0) {
    git_reference_free(branchRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to peel branch target"), env.Null();
  }

  git_checkout_options opts = GIT_CHECKOUT_OPTIONS_INIT;
  opts.checkout_strategy = GIT_CHECKOUT_SAFE;
  if (git_checkout_tree(repo, target, &opts) != 0) {
    git_object_free(target);
    git_reference_free(branchRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to checkout branch"), env.Null();
  }

  if (git_repository_set_head(repo, git_reference_name(branchRef)) != 0) {
    git_object_free(target);
    git_reference_free(branchRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to set HEAD"), env.Null();
  }

  git_object_free(target);
  git_reference_free(branchRef);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return Napi::Boolean::New(env, true);
}

Napi::Value Fetch(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  std::string remoteName = "origin";
  if (info.Length() > 1 && info[1].IsString()) {
    remoteName = info[1].As<Napi::String>().Utf8Value();
  }

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_remote *remote = nullptr;
  if (git_remote_lookup(&remote, repo, remoteName.c_str()) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to find remote"), env.Null();
  }

  git_fetch_options opts = GIT_FETCH_OPTIONS_INIT;
  if (git_remote_fetch(remote, nullptr, &opts, nullptr) != 0) {
    git_remote_free(remote);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "fetch failed"), env.Null();
  }

  git_remote_free(remote);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return Napi::Boolean::New(env, true);
}

Napi::Value Pull(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  std::string remoteName = "origin";
  if (info.Length() > 1 && info[1].IsString()) {
    remoteName = info[1].As<Napi::String>().Utf8Value();
  }

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  std::string branch = CurrentBranchName(repo);
  if (branch.empty()) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "detached HEAD is not supported for pull"),
           env.Null();
  }

  git_remote *remote = nullptr;
  if (git_remote_lookup(&remote, repo, remoteName.c_str()) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to find remote"), env.Null();
  }
  git_fetch_options fetchOpts = GIT_FETCH_OPTIONS_INIT;
  if (git_remote_fetch(remote, nullptr, &fetchOpts, nullptr) != 0) {
    git_remote_free(remote);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "pull fetch failed"), env.Null();
  }
  git_remote_free(remote);

  std::string remoteRefName = "refs/remotes/" + remoteName + "/" + branch;
  git_reference *remoteRef = nullptr;
  if (git_reference_lookup(&remoteRef, repo, remoteRefName.c_str()) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "remote tracking branch not found"), env.Null();
  }

  git_annotated_commit *remoteHead = nullptr;
  if (git_annotated_commit_from_ref(&remoteHead, repo, remoteRef) != 0) {
    git_reference_free(remoteRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to read remote head"), env.Null();
  }

  const git_annotated_commit *heads[] = {remoteHead};
  git_merge_analysis_t analysis;
  git_merge_preference_t pref;
  if (git_merge_analysis(&analysis, &pref, repo, heads, 1) != 0) {
    git_annotated_commit_free(remoteHead);
    git_reference_free(remoteRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to analyze merge"), env.Null();
  }

  if (analysis & GIT_MERGE_ANALYSIS_UP_TO_DATE) {
    git_annotated_commit_free(remoteHead);
    git_reference_free(remoteRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return Napi::Boolean::New(env, true);
  }

  if (!(analysis & GIT_MERGE_ANALYSIS_FASTFORWARD)) {
    git_annotated_commit_free(remoteHead);
    git_reference_free(remoteRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    Napi::Error::New(env, "non-fast-forward pull is not supported yet")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  const git_oid *targetOid = git_annotated_commit_id(remoteHead);
  git_object *target = nullptr;
  if (git_object_lookup(&target, repo, targetOid, GIT_OBJECT_COMMIT) != 0) {
    git_annotated_commit_free(remoteHead);
    git_reference_free(remoteRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to lookup fetched commit"), env.Null();
  }

  git_checkout_options checkoutOpts = GIT_CHECKOUT_OPTIONS_INIT;
  checkoutOpts.checkout_strategy = GIT_CHECKOUT_SAFE;
  if (git_checkout_tree(repo, target, &checkoutOpts) != 0 ||
      git_reference_set_target(&remoteRef, remoteRef, targetOid,
                               "gitbox pull") != 0) {
    git_object_free(target);
    git_annotated_commit_free(remoteHead);
    git_reference_free(remoteRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to fast-forward working tree"),
           env.Null();
  }

  std::string localRefName = "refs/heads/" + branch;
  git_reference *localRef = nullptr;
  if (git_reference_lookup(&localRef, repo, localRefName.c_str()) != 0 ||
      git_reference_set_target(&localRef, localRef, targetOid, "gitbox pull") !=
          0 ||
      git_repository_set_head(repo, localRefName.c_str()) != 0) {
    if (localRef != nullptr)
      git_reference_free(localRef);
    git_object_free(target);
    git_annotated_commit_free(remoteHead);
    git_reference_free(remoteRef);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to update local branch"), env.Null();
  }

  git_reference_free(localRef);
  git_object_free(target);
  git_annotated_commit_free(remoteHead);
  git_reference_free(remoteRef);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return Napi::Boolean::New(env, true);
}

Napi::Value Remotes(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }
  git_strarray remotes = {0};
  if (git_remote_list(&remotes, repo) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return env.Null();
  }
  Napi::Array result = Napi::Array::New(env);
  for (size_t i = 0; i < remotes.count; ++i) {
    result.Set(i, Napi::String::New(env, remotes.strings[i]));
  }
  git_strarray_free(&remotes);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return result;
}

Napi::Value Tags(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }
  git_strarray tags = {0};
  if (git_tag_list(&tags, repo) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
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
  git_libgit2_shutdown();
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

  git_commit *commit = nullptr;
  if (git_commit_lookup(&commit, git_commit_owner((git_commit *)payload),
                        stash_id) == 0 ||
      git_commit_lookup(&commit, data->repo, stash_id) == 0) {
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
  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  StashData data{std::vector<Napi::Object>(), env, repo};
  git_stash_foreach(repo, StashCallback, &data);

  Napi::Array result = Napi::Array::New(env);
  for (size_t i = 0; i < data.stashes.size(); i++) {
    result.Set(i, data.stashes[i]);
  }

  git_repository_free(repo);
  git_libgit2_shutdown();
  return result;
}

Napi::Value Push(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  std::string remoteName = "origin";
  if (info.Length() > 1 && info[1].IsString()) {
    remoteName = info[1].As<Napi::String>().Utf8Value();
  }

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  std::string branch = CurrentBranchName(repo);
  if (branch.empty()) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "detached HEAD is not supported for push"),
           env.Null();
  }

  git_remote *remote = nullptr;
  if (git_remote_lookup(&remote, repo, remoteName.c_str()) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "failed to find remote"), env.Null();
  }

  std::string spec = "refs/heads/" + branch + ":refs/heads/" + branch;
  char *rawSpec = const_cast<char *>(spec.c_str());
  git_strarray refspecs{&rawSpec, 1};
  git_push_options opts = GIT_PUSH_OPTIONS_INIT;
  if (git_remote_push(remote, &refspecs, &opts) != 0) {
    git_remote_free(remote);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "push failed"), env.Null();
  }

  git_remote_free(remote);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return Napi::Boolean::New(env, true);
}

Napi::Value DiffFile(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "filePath"))
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string repoPath = repoValue.As<Napi::String>().Utf8Value();
  std::string filePath = info[1].As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, repoPath, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  std::string original = HeadFileContent(repo, filePath);
  std::string modified = ReadFile(repoPath + "/" + filePath);

  Napi::Object result = Napi::Object::New(env);
  result.Set("path", Napi::String::New(env, filePath));
  result.Set("original", Napi::String::New(env, original));
  result.Set("modified", Napi::String::New(env, modified));

  git_repository_free(repo);
  git_libgit2_shutdown();
  return result;
  git_repository_free(repo);
  git_libgit2_shutdown();
  return result;
}

Napi::Value StashChanges(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();
  if (!EnsureStringArg(info, 1, "stashId"))
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string repoPath = repoValue.As<Napi::String>().Utf8Value();
  std::string stashId = info[1].As<Napi::String>().Utf8Value();

  if (!OpenRepoOrThrow(env, repoPath, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_oid oid;
  if (git_oid_fromstr(&oid, stashId.c_str()) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "invalid stash OID"), env.Null();
  }

  git_commit *stash_commit = nullptr;
  if (git_commit_lookup(&stash_commit, repo, &oid) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "stash commit not found"), env.Null();
  }

  git_commit *parent_commit = nullptr;
  if (git_commit_parent(&parent_commit, stash_commit, 0) != 0) {
    git_commit_free(stash_commit);
    git_repository_free(repo);
    git_libgit2_shutdown();
    return ThrowGitError(env, "stash parent not found"), env.Null();
  }

  git_tree *stash_tree = nullptr;
  git_commit_tree(&stash_tree, stash_commit);

  git_tree *parent_tree = nullptr;
  git_commit_tree(&parent_tree, parent_commit);

  git_diff *diff = nullptr;
  git_diff_tree_to_tree(&diff, repo, parent_tree, stash_tree, nullptr);

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
      statusStr = "untracked";
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
  git_libgit2_shutdown();
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

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string repoPath = repoValue.As<Napi::String>().Utf8Value();
  std::string stashId = info[1].As<Napi::String>().Utf8Value();
  std::string filePath = info[2].As<Napi::String>().Utf8Value();

  if (!OpenRepoOrThrow(env, repoPath, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_oid oid;
  git_oid_fromstr(&oid, stashId.c_str());
  git_commit *stash_commit = nullptr;
  git_commit_lookup(&stash_commit, repo, &oid);

  git_commit *parent_commit = nullptr;
  git_commit_parent(&parent_commit, stash_commit, 0);

  git_tree *stash_tree = nullptr;
  git_commit_tree(&stash_tree, stash_commit);

  git_tree *parent_tree = nullptr;
  git_commit_tree(&parent_tree, parent_commit);

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
  git_libgit2_shutdown();
  return result;
}

} // namespace

Napi::Value GetConfig(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto repoValue = EnsureRepo(info);
  if (env.IsExceptionPending())
    return env.Null();

  git_libgit2_init();
  git_repository *repo = nullptr;
  std::string path = repoValue.As<Napi::String>().Utf8Value();
  if (!OpenRepoOrThrow(env, path, &repo)) {
    git_libgit2_shutdown();
    return env.Null();
  }

  git_config *cfg = nullptr;
  if (git_repository_config(&cfg, repo) != 0) {
    git_repository_free(repo);
    git_libgit2_shutdown();
    return env.Null();
  }

  Napi::Object result = Napi::Object::New(env);

  const char *name = nullptr;
  if (git_config_get_string(&name, cfg, "user.name") == 0 && name != nullptr) {
    result.Set("userName", Napi::String::New(env, name));
  } else {
    result.Set("userName", Napi::String::New(env, ""));
  }

  const char *email = nullptr;
  if (git_config_get_string(&email, cfg, "user.email") == 0 &&
      email != nullptr) {
    result.Set("userEmail", Napi::String::New(env, email));
  } else {
    result.Set("userEmail", Napi::String::New(env, ""));
  }

  git_config_free(cfg);
  git_repository_free(repo);
  git_libgit2_shutdown();
  return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("getConfig", Napi::Function::New(env, GetConfig));
  exports.Set("status", Napi::Function::New(env, Status));
  exports.Set("branches", Napi::Function::New(env, Branches));
  exports.Set("remotes", Napi::Function::New(env, Remotes));
  exports.Set("tags", Napi::Function::New(env, Tags));
  exports.Set("stashes", Napi::Function::New(env, Stashes));
  exports.Set("log", Napi::Function::New(env, Log));
  exports.Set("stageAll", Napi::Function::New(env, StageAll));
  exports.Set("unstageAll", Napi::Function::New(env, UnstageAll));
  exports.Set("discardAll", Napi::Function::New(env, DiscardAll));
  exports.Set("commitAll", Napi::Function::New(env, CommitAll));
  exports.Set("checkoutBranch", Napi::Function::New(env, CheckoutBranch));
  exports.Set("fetch", Napi::Function::New(env, Fetch));
  exports.Set("pull", Napi::Function::New(env, Pull));
  exports.Set("push", Napi::Function::New(env, Push));
  exports.Set("diffFile", Napi::Function::New(env, DiffFile));
  exports.Set("stashChanges", Napi::Function::New(env, StashChanges));
  exports.Set("diffStashFile", Napi::Function::New(env, DiffStashFile));
  return exports;
}

NODE_API_MODULE(gitbox_addon, Init)
