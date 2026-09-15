/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable unicorn/no-this-assignment */
/* eslint-disable unicorn/prefer-at */
import type { AlbumResponseDto, TagResponseDto } from '@immich/sdk';

export class TreeNode extends Map<string, TreeNode> {
  value: string;
  path: string;
  parent: TreeNode | null;
  hasAssets: boolean;
  id: string | undefined;
  color: string | undefined;
  albums: AlbumResponseDto[];
  private _parents: TreeNode[] | undefined;
  private _children: TreeNode[] | undefined;

  private constructor(value: string, path: string, parent: TreeNode | null) {
    super();
    this.value = value;
    this.parent = parent;
    this.path = path;
    this.hasAssets = false;
    this.albums = [];
  }

  static fromPaths(paths: string[]) {
    const root = new TreeNode('', '', null);
    for (const path of paths) {
      const current = root.add(path);
      current.hasAssets = true;
    }
    return root;
  }

  /**
   * Builds a virtual folder hierarchy out of flat album names, splitting each name on `separator`.
   * The trailing segment is the album's own label, so `Vacation/2013-11 USA` with a `/` separator
   * puts one album inside a single `Vacation` node. Albums without a separator stay at the root.
   */
  static fromAlbums(albums: AlbumResponseDto[], separator: string) {
    const root = new TreeNode('', '', null);
    for (const album of albums) {
      const parts = getAlbumNameParts(album.albumName, separator);
      const node = root.addParts(parts.slice(0, -1));
      node.albums.push(album);
      node.hasAssets = true;
    }
    return root;
  }

  static fromTags(tags: TagResponseDto[]) {
    const root = new TreeNode('', '', null);
    for (const tag of tags) {
      const current = root.add(tag.value);
      current.hasAssets = true;
      current.id = tag.id;
      current.color = tag.color;
    }
    return root;
  }

  traverse(path: string) {
    const parts = getPathParts(path);
    let current: TreeNode = this;
    let curPart = null;
    for (const part of parts) {
      // segments common to all subtrees can be collapsed together
      curPart = curPart === null ? part : joinPaths(curPart, part);
      const next = current.get(curPart);
      if (next) {
        current = next;
        curPart = null;
      }
    }
    return current;
  }

  collapse() {
    if (this.size === 1 && !this.hasAssets && this.parent !== null) {
      const child = this.values().next().value!;
      child.value = joinPaths(this.value, child.value);
      child.parent = this.parent;

      const entries = Array.from(this.parent.entries());
      this.parent.clear();
      for (const [key, value] of entries) {
        if (key === this.value) {
          this.parent.set(child.value, child);
        } else {
          this.parent.set(key, value);
        }
      }
    }

    for (const child of this.values()) {
      child.collapse();
    }
  }

  private add(path: string) {
    let current: TreeNode = this;
    for (const part of getPathParts(path)) {
      let next = current.get(part);
      if (next === undefined) {
        next = new TreeNode(part, joinPaths(current.path, part), current);
        current.set(part, next);
      }
      current = next;
    }
    return current;
  }

  private addParts(parts: string[]) {
    let current: TreeNode = this;
    for (const part of parts) {
      // the map key has to match what `traverse` sees after splitting a path on '/', so album
      // names containing a literal '/' (possible when another separator is configured) are encoded
      const key = encodeTreeSegment(part);
      let next = current.get(key);
      if (next === undefined) {
        next = new TreeNode(part, joinPaths(current.path, key), current);
        current.set(key, next);
      }
      current = next;
    }
    return current;
  }

  /** Number of albums at this node and everywhere below it. */
  get albumCount(): number {
    let count = this.albums.length;
    for (const child of this.values()) {
      count += child.albumCount;
    }
    return count;
  }

  get parents(): TreeNode[] {
    if (this._parents) {
      return this._parents;
    }
    const parents: TreeNode[] = [];
    let current: TreeNode | null = this.parent;
    while (current !== null && current.parent !== null) {
      parents.push(current);
      current = current.parent;
    }
    return (this._parents = parents.reverse());
  }

  get children(): TreeNode[] {
    return (this._children ??= Array.from(this.values()));
  }
}

const encodeTreeSegment = (segment: string) => segment.replaceAll('/', '%2F');

/**
 * Splits an album name into its hierarchy segments. Empty segments are dropped so that names like
 * `Vacation/` or `/USA` do not produce anonymous levels. Returns the whole name as a single segment
 * when nesting is disabled or the name has no usable segments.
 */
export const getAlbumNameParts = (albumName: string, separator: string) => {
  if (!separator) {
    return [albumName];
  }

  const parts = albumName.split(separator).filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [albumName];
};

/** The label an album shows when nested, i.e. its name without the parent segments. */
export const getAlbumDisplayName = (albumName: string, separator: string) => {
  const parts = getAlbumNameParts(albumName, separator);
  return parts[parts.length - 1];
};

export const normalizeTreePath = (path: string) =>
  path.length > 1 && path[path.length - 1] === '/' ? path.slice(0, -1) : path;

export function getPathParts(path: string) {
  const parts = path.split('/');
  if (path[0] === '/') {
    parts[0] = '/';
  }

  if (path[path.length - 1] === '/') {
    parts.pop();
  }

  return parts;
}

export function joinPaths(path1: string, path2: string) {
  if (!path1) {
    return path2;
  }

  if (!path2) {
    return path1;
  }

  if (path1[path1.length - 1] === '/') {
    return path1 + path2;
  }

  return path1 + '/' + path2;
}

export function getParentPath(path: string) {
  const normalized = normalizeTreePath(path);
  const last = normalized.lastIndexOf('/');
  if (last > 0) {
    return normalized.slice(0, last);
  }
  return last === 0 ? '/' : normalized;
}
