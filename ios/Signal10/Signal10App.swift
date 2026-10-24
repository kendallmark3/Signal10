import SwiftUI

@main
struct Signal10App: App {
    @State private var app: AppModel?

    init() {
        // The UI tests start from a fresh install's state: signed out, nothing watched or recent.
        if CommandLine.arguments.contains("-uitest-reset") {
            if let domain = Bundle.main.bundleIdentifier { UserDefaults.standard.removePersistentDomain(forName: domain) }
            HTTPCookieStorage.shared.removeCookies(since: .distantPast)
        }
        _app = State(initialValue: AppConfig.baseURL.map { AppModel(client: Signal10Client(baseURL: $0)) })
    }

    var body: some Scene {
        WindowGroup {
            if let app {
                RootView()
                    .environment(app)
                    .tint(.brand)
            } else {
                ContentUnavailableView("Signal10 is not configured", systemImage: "exclamationmark.triangle",
                                       description: Text("Set SIGNAL10_BASE_URL in ios/Config."))
            }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var app
    @State private var path: [String] = []

    var body: some View {
        @Bindable var app = app
        NavigationStack(path: $path) {
            HomeView { topic in
                app.remember(topic)
                path.append(topic)
            }
            .navigationDestination(for: String.self) { topic in
                ResultsView(topic: topic)
            }
        }
        .sheet(isPresented: $app.needsSignIn) {
            SignInView()
        }
    }
}
