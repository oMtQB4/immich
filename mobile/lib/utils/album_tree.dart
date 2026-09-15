import 'package:immich_mobile/domain/models/album/album.model.dart';

/// Splits an album name into its hierarchy segments.
///
/// Empty segments are dropped so names like `Urlaube/` or `/USA` do not produce anonymous levels.
/// Returns the whole name as a single segment when nesting is disabled or nothing usable is left.
List<String> splitAlbumName(String name, String separator) {
  if (separator.isEmpty) {
    return [name];
  }

  final parts = name.split(separator).where((part) => part.isNotEmpty).toList();
  return parts.isEmpty ? [name] : parts;
}

/// The label an album shows when nested, i.e. its name without the parent segments.
String albumDisplayName(String name, String separator) => splitAlbumName(name, separator).last;

/// A virtual folder built from album names, e.g. `Urlaube/2013-11 USA` puts one album inside a
/// single `Urlaube` node. Albums keep their full name on the server; this only affects display.
class AlbumTreeNode {
  AlbumTreeNode({required this.name});

  final String name;
  final Map<String, AlbumTreeNode> children = {};

  /// Albums located directly at this node.
  final List<RemoteAlbum> albums = [];

  List<AlbumTreeNode> get childNodes => children.values.toList(growable: false);

  /// Number of albums at this node and everywhere below it.
  int get albumCount => albums.length + children.values.fold(0, (total, child) => total + child.albumCount);

  static AlbumTreeNode build(List<RemoteAlbum> albums, String separator) {
    final root = AlbumTreeNode(name: '');
    for (final album in albums) {
      final parts = splitAlbumName(album.name, separator);
      var current = root;
      // the trailing segment is the album's own label, not a folder
      for (final part in parts.take(parts.length - 1)) {
        current = current.children.putIfAbsent(part, () => AlbumTreeNode(name: part));
      }
      current.albums.add(album);
    }
    return root;
  }

  /// Walks down [path], stopping at the deepest node that still exists. A path that disappeared
  /// (because of filtering or a rename) therefore resolves to its closest surviving ancestor.
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

  /// The part of [path] that actually resolves, used to keep navigation state in sync.
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
