export interface TreeNode<T = any> {
    name: string;
    displayName: string;
    fullPath: string;
    isGroup: boolean;
    children: TreeNode<T>[];
    count: number;
    level: number;
    /** Resolved expansion state, annotated by flattenTree so the row and the
     *  flattening logic never disagree. */
    expanded?: boolean;
    data?: T;
}

export interface TreeOptions<T> {
    expandedGroups: Record<string, boolean>;
    currentPath?: string;
    getPath: (item: T) => string;
    sortNodes?: (a: TreeNode<T>, b: TreeNode<T>) => number;
}

/**
 * Builds a hierarchical tree from a list of items based on their paths.
 */
export function buildTree<T>(items: T[], options: TreeOptions<T>): TreeNode<T>[] {
    const root: TreeNode<T>[] = [];

    for (const item of items) {
        const path = options.getPath(item);
        const parts = path.split('/');
        let currentLevel = root;
        let currentFullPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentFullPath += (i === 0 ? part : '/' + part);

            if (i === parts.length - 1) {
                // Leaf node
                currentLevel.push({
                    name: part,
                    displayName: part,
                    fullPath: path,
                    isGroup: false,
                    children: [],
                    count: 1,
                    level: i,
                    data: item
                });
            } else {
                // Group node
                let group = currentLevel.find(n => n.isGroup && n.fullPath === currentFullPath);
                if (!group) {
                    group = {
                        name: part,
                        displayName: part,
                        fullPath: currentFullPath,
                        isGroup: true,
                        children: [],
                        count: 0,
                        level: i
                    };
                    currentLevel.push(group);
                }
                currentLevel = group.children;
            }
        }
    }

    function finalize(nodes: TreeNode<T>[]) {
        for (const node of nodes) {
            if (node.isGroup) {
                finalize(node.children);
                node.count = node.children.reduce((acc, c) => acc + c.count, 0);
            }
        }

        nodes.sort((a, b) => {
            if (a.isGroup !== b.isGroup) return a.isGroup ? -1 : 1;
            if (options.sortNodes) return options.sortNodes(a, b);
            return a.displayName.localeCompare(b.displayName);
        });
    }

    finalize(root);
    return root;
}

/**
 * Flattens a tree into a list for virtual scrolling, respecting expansion state.
 */
export function flattenTree<T>(nodes: TreeNode<T>[], expandedGroups: Record<string, boolean>, currentPath?: string): TreeNode<T>[] {
    const flat: TreeNode<T>[] = [];

    function walk(list: TreeNode<T>[]) {
        for (const node of list) {
            // Default: closed. A group is only open when explicitly toggled open
            // (persisted per repo by the caller). Keyed by fullPath so nested
            // groups (feature/foo) don't collide with same-named siblings.
            const isExpanded = expandedGroups[node.fullPath] === true;
            if (node.isGroup) node.expanded = isExpanded;

            flat.push(node);

            if (node.isGroup && isExpanded) {
                walk(node.children);
            }
        }
    }

    walk(nodes);
    return flat;
}
