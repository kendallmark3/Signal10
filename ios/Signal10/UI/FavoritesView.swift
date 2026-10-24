import SwiftUI

struct FavoritesView: View {
    @Environment(AppModel.self) private var app
    @State private var playing: Favorite?

    var body: some View {
        Group {
            if app.favorites.isEmpty {
                ContentUnavailableView("No favorites yet", systemImage: "star",
                                       description: Text("Tap the star on a video to keep it here."))
            } else {
                List {
                    ForEach(app.favorites) { favorite in
                        Button { playing = favorite } label: { row(favorite) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("favorite-\(favorite.id)")
                    }
                    .onDelete { offsets in
                        let list = app.favorites
                        offsets.map { list[$0].id }.forEach(app.removeFavorite)
                    }
                }
                .listStyle(.plain)
                .toolbar { EditButton() }
            }
        }
        .navigationTitle("Favorites")
        .sheet(item: $playing) { FavoritePlayerSheet(favorite: $0) }
    }

    private func row(_ favorite: Favorite) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Thumbnail(url: favorite.thumbnail, duration: favorite.durationText)
                .frame(width: 120)
            VStack(alignment: .leading, spacing: 4) {
                Text(favorite.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(3)
                Text(favorite.channel).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                Text("From “\(favorite.topic)”").font(.caption).foregroundStyle(Color.brand).lineLimit(1)
            }
        }
        .contentShape(Rectangle())
    }
}

struct FavoritePlayerSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @AppStorage(AppSettings.autoplayKey) private var autoplay = true
    let favorite: Favorite

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                YouTubePlayer(videoID: favorite.id, autoplay: autoplay)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .background { Color.black }
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(favorite.title).font(.title3.weight(.semibold))
                            Text([favorite.channel, favorite.durationText].compactMap { $0 }.joined(separator: " · "))
                                .font(.subheadline).foregroundStyle(.secondary)
                            Text("Saved from “\(favorite.topic)” on \(favorite.savedAt.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Link(destination: favorite.url) {
                            Label("Open on YouTube", systemImage: "arrow.up.right.square").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                        Button(role: .destructive) {
                            app.removeFavorite(favorite.id)
                            dismiss()
                        } label: {
                            Label("Remove from favorites", systemImage: "star.slash").frame(maxWidth: .infinity)
                        }
                        .controlSize(.large)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Favorite")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.accessibilityIdentifier("doneButton") }
            }
        }
    }
}
