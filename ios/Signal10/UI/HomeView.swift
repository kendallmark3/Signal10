import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var app
    let search: (String) -> Void

    @State private var text = ""
    @FocusState private var focused: Bool
    @State private var showSettings = false
    @State private var showHelp = false

    private static let examples = [
        "AWS AgentCore", "Claude Code", "Swift concurrency",
        "Linear algebra for AI", "COBOL modernization", "Enterprise AI governance",
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Wordmark(height: 52)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8)

                VStack(alignment: .leading, spacing: 14) {
                    Text("What do you want to learn?")
                        .font(.largeTitle.bold())
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                        TextField("A topic, skill or technology", text: $text)
                            .font(.title3)
                            .submitLabel(.search)
                            .focused($focused)
                            .autocorrectionDisabled()
                            .onSubmit(submit)
                            .accessibilityIdentifier("topicField")
                        if !text.isEmpty {
                            Button { text = "" } label: {
                                Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary)
                            }
                            .accessibilityLabel("Clear")
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))

                    Button(action: submit) {
                        Text("Find my learning path")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(Topic.clean(text) == nil)
                    .accessibilityIdentifier("findButton")
                }

                if !app.favorites.isEmpty {
                    favoritesRow
                }
                if !app.recent.isEmpty {
                    topics("Recent", app.recent, icon: "clock.arrow.circlepath")
                }
                topics("Try", Self.examples, icon: "sparkle.magnifyingglass")
            }
            .padding(20)
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { showHelp = true } label: { Image(systemName: "questionmark.circle") }
                    .accessibilityLabel("Help")
                Button { showSettings = true } label: { Image(systemName: "gearshape") }
                    .accessibilityLabel("Settings")
                    .accessibilityIdentifier("settingsButton")
            }
        }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showHelp) {
            NavigationStack {
                HelpView().toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { showHelp = false } }
                }
            }
        }
    }

    private var favoritesRow: some View {
        NavigationLink(value: Route.favorites) {
            HStack(spacing: 12) {
                Image(systemName: "star.fill")
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Color.brand, in: RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Favorites").font(.headline).foregroundStyle(.primary)
                    Text(app.favorites.count == 1 ? "1 saved video" : "\(app.favorites.count) saved videos")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
            }
            .padding(12)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("favoritesRow")
    }

    private func topics(_ title: String, _ list: [String], icon: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            FlowLayout(spacing: 8) {
                ForEach(list, id: \.self) { topic in
                    Button(topic) { go(topic) }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .tint(.primary)
                }
            }
        }
    }

    private func submit() {
        guard let topic = Topic.clean(text) else { return }
        go(topic)
    }

    private func go(_ topic: String) {
        focused = false
        search(topic)
    }
}
