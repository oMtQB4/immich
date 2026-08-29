import { describe, expect, it } from 'vitest';
import { albumFactory } from '@test-data/factories/album-factory';
import { getAlbumDisplayName, getAlbumNameParts, TreeNode } from './tree-utils';

describe('getAlbumNameParts', () => {
  it('returns the whole name when nesting is disabled', () => {
    expect(getAlbumNameParts('Urlaube/2013-11 USA', '')).toEqual(['Urlaube/2013-11 USA']);
  });

  it('splits on the configured separator', () => {
    expect(getAlbumNameParts('Urlaube/2013-11 USA', '/')).toEqual(['Urlaube', '2013-11 USA']);
    expect(getAlbumNameParts('Urlaube-2013', '-')).toEqual(['Urlaube', '2013']);
  });

  it('drops empty segments', () => {
    expect(getAlbumNameParts('/USA', '/')).toEqual(['USA']);
    expect(getAlbumNameParts('Urlaube/', '/')).toEqual(['Urlaube']);
    expect(getAlbumNameParts('Urlaube//USA', '/')).toEqual(['Urlaube', 'USA']);
  });

  it('falls back to the raw name when every segment is empty', () => {
    expect(getAlbumNameParts('///', '/')).toEqual(['///']);
  });
});

describe('getAlbumDisplayName', () => {
  it('returns the last segment', () => {
    expect(getAlbumDisplayName('Urlaube/2013-11 USA', '/')).toBe('2013-11 USA');
  });

  it('returns the full name when nesting is disabled', () => {
    expect(getAlbumDisplayName('Urlaube/2013-11 USA', '')).toBe('Urlaube/2013-11 USA');
  });
});

describe('TreeNode.fromAlbums', () => {
  const albums = [
    albumFactory.build({ albumName: 'Urlaube/2013-11 USA' }),
    albumFactory.build({ albumName: 'Urlaube/2016-07 Italien' }),
    albumFactory.build({ albumName: 'Urlaube/Kurztrips/2019 Norwegen' }),
    albumFactory.build({ albumName: 'Familie' }),
  ];

  it('keeps albums without a separator at the root', () => {
    const root = TreeNode.fromAlbums(albums, '/');

    expect(root.albums.map(({ albumName }) => albumName)).toEqual(['Familie']);
    expect(root.children.map(({ value }) => value)).toEqual(['Urlaube']);
  });

  it('nests albums under each name segment', () => {
    const root = TreeNode.fromAlbums(albums, '/');
    const urlaube = root.traverse('Urlaube');

    expect(urlaube.albums.map(({ albumName }) => albumName)).toEqual([
      'Urlaube/2013-11 USA',
      'Urlaube/2016-07 Italien',
    ]);
    expect(root.traverse('Urlaube/Kurztrips').albums).toHaveLength(1);
  });

  it('counts albums in the whole subtree', () => {
    const root = TreeNode.fromAlbums(albums, '/');

    expect(root.albumCount).toBe(4);
    expect(root.traverse('Urlaube').albumCount).toBe(3);
    expect(root.traverse('Urlaube/Kurztrips').albumCount).toBe(1);
  });

  it('produces a flat tree when nesting is disabled', () => {
    const root = TreeNode.fromAlbums(albums, '');

    expect(root.children).toHaveLength(0);
    expect(root.albums).toHaveLength(4);
  });

  it('keeps names containing a slash addressable under a different separator', () => {
    const root = TreeNode.fromAlbums([albumFactory.build({ albumName: 'A/B-2019' })], '-');
    const node = root.children[0];

    expect(node.value).toBe('A/B');
    expect(node.albums).toHaveLength(1);
    expect(root.traverse(node.path)).toBe(node);
  });
});
