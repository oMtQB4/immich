import 'package:immich_mobile/domain/models/album/album.model.dart';

/// Splits an album name into hierarchy segments, dropping empty ones.
List<String> splitAlbumName(String name, String separator) {
  if (separator.isEmpty) {
    return [name];
  }

  final parts = name.split(separator).where((part) => part.isNotEmpty).toList();
  return parts.isEmpty ? [name] : parts;
}

/// An album's name without its parent segments.
String albumDisplayName(String name, String separator) => splitAlbumName(name, separator).last;

/// A virtual folder built from album names. Display only, names are not changed on the server.
class AlbumTreeNode {
  AlbumTreeNode({required this.name});

  final String name;
  final Map<String, AlbumTreeNode> children = {};

  final List<RemoteAlbum> albums = [];

  List<AlbumTreeNode> get childNodes => children.values.toList(growable: false);

  int get albumCount => albums.length + children.values.fold(0, (total, child) => total + child.albumCount);

  static AlbumTreeNode build(List<RemoteAlbum> albums, String separator) {
    final root = AlbumTreeNode(name: '');
    for (final album in albums) {
      final parts = splitAlbumName(album.name, separator);
      var current = root;
      // the last segment is the album's own label, not a folder
      for (final part in parts.take(parts.length - 1)) {
        current = current.children.putIfAbsent(part, () => AlbumTreeNode(name: part));
      }
      current.albums.add(album);
    }
    return root;
  }

  /// Walks down [path], falling back to the closest surviving ancestor.
  AlbumTreeNode traverse(List<String> path) {
    var current = this;
    for (final segment in path) {
      final next = current.children[segment];
      if (next == null) {
        break;
      }
      current = next;
    }
    return current;
  }

  /// The part of [path] that still resolves.
  List<String> resolvePath(List<String> path) {
    final resolved = <String>[];
    var current = this;
    for (final segment in path) {
      final next = current.children[segment];
      if (next == null) {
        break;
      }
      current = next;
      resolved.add(segment);
    }
    return resolved;
  }
}
