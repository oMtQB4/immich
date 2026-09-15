import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/utils/album_tree.dart';

RemoteAlbum _album(String name) => RemoteAlbum(
  id: name,
  name: name,
  ownerId: 'owner',
  description: '',
  createdAt: DateTime(2020),
  updatedAt: DateTime(2020),
  isActivityEnabled: true,
  order: AlbumAssetOrder.desc,
  assetCount: 0,
  ownerName: 'owner',
  isShared: false,
);

void main() {
  group('splitAlbumName', () {
    test('returns the whole name when nesting is disabled', () {
      expect(splitAlbumName('Urlaube/2013-11 USA', ''), ['Urlaube/2013-11 USA']);
    });

    test('splits on the configured separator', () {
      expect(splitAlbumName('Urlaube/2013-11 USA', '/'), ['Urlaube', '2013-11 USA']);
      expect(splitAlbumName('Urlaube-2013', '-'), ['Urlaube', '2013']);
    });

    test('drops empty segments', () {
      expect(splitAlbumName('/USA', '/'), ['USA']);
      expect(splitAlbumName('Urlaube/', '/'), ['Urlaube']);
      expect(splitAlbumName('Urlaube//USA', '/'), ['Urlaube', 'USA']);
    });

    test('falls back to the raw name when every segment is empty', () {
      expect(splitAlbumName('///', '/'), ['///']);
    });
  });

  group('albumDisplayName', () {
    test('returns the last segment', () {
      expect(albumDisplayName('Urlaube/2013-11 USA', '/'), '2013-11 USA');
    });

    test('returns the full name when nesting is disabled', () {
      expect(albumDisplayName('Urlaube/2013-11 USA', ''), 'Urlaube/2013-11 USA');
    });
  });

  group('AlbumTreeNode', () {
    final albums = [
      _album('Urlaube/2013-11 USA'),
      _album('Urlaube/2016-07 Italien'),
      _album('Urlaube/Kurztrips/2019 Norwegen'),
      _album('Familie'),
    ];

    test('keeps albums without a separator at the root', () {
      final root = AlbumTreeNode.build(albums, '/');

      expect(root.albums.map((album) => album.name), ['Familie']);
      expect(root.childNodes.map((node) => node.name), ['Urlaube']);
    });

    test('nests albums under each name segment', () {
      final root = AlbumTreeNode.build(albums, '/');

      expect(root.traverse(['Urlaube']).albums.map((album) => album.name), [
        'Urlaube/2013-11 USA',
        'Urlaube/2016-07 Italien',
      ]);
      expect(root.traverse(['Urlaube', 'Kurztrips']).albums, hasLength(1));
    });

    test('counts albums in the whole subtree', () {
      final root = AlbumTreeNode.build(albums, '/');

      expect(root.albumCount, 4);
      expect(root.traverse(['Urlaube']).albumCount, 3);
      expect(root.traverse(['Urlaube', 'Kurztrips']).albumCount, 1);
    });

    test('produces a flat tree when nesting is disabled', () {
      final root = AlbumTreeNode.build(albums, '');

      expect(root.childNodes, isEmpty);
      expect(root.albums, hasLength(4));
    });

    test('resolves a path that no longer exists to its closest ancestor', () {
      final root = AlbumTreeNode.build(albums, '/');

      expect(root.resolvePath(['Urlaube', 'Weg', 'Tiefer']), ['Urlaube']);
      expect(root.traverse(['Urlaube', 'Weg']).name, 'Urlaube');
    });
  });
}
