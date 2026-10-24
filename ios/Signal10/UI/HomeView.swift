import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var app
    let search: (String) -> Void

    @State private var text = ""
    @FocusState private var focused: Bool

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

                if !app.recent.isEmpty {
                    topics("Recent", app.recent, icon: "clock.arrow.circlepath")
                }
                topics("Try", Self.examples, icon: "sparkle.magnifyingglass")
            }
            .padding(20)
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Text("Server: \(app.client.baseURL.host() ?? "")")
                    Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") {
                        Task { await app.signOut() }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("More")
            }
        }
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
