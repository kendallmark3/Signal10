import XCTest

/// The whole flow against a real Signal10 server: sign in, search, start the path, play, mark
/// watched, come back and continue. It needs a running server and its credentials, so it is not
/// part of the default test plan; ios/README.md shows how to run it. Credentials come from the
/// environment (TEST_RUNNER_SIGNAL10_USERNAME / _PASSWORD) and are never written into the repo.
final class LearningPathUITests: XCTestCase {
    private var app: XCUIApplication!
    private let env = ProcessInfo.processInfo.environment

    override func setUpWithError() throws {
        continueAfterFailure = false
        guard env["SIGNAL10_USERNAME"] != nil, env["SIGNAL10_PASSWORD"] != nil else {
            throw XCTSkip("Set TEST_RUNNER_SIGNAL10_USERNAME and TEST_RUNNER_SIGNAL10_PASSWORD to run against a server.")
        }
        app = XCUIApplication()
        app.launchArguments = ["-uitest-reset"]
        app.launch()
    }

    func testSearchWatchAndContinue() throws {
        let topic = env["SIGNAL10_TOPIC"] ?? "AWS AgentCore"
        snapshot("01-home")

        let field = app.textFields["topicField"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText(topic)
        app.buttons["findButton"].tap()

        // Signed out, so the server's sign-in appears first.
        let username = app.textFields["username"]
        XCTAssertTrue(username.waitForExistence(timeout: 30), "sign-in sheet")
        username.tap()
        username.typeText(env["SIGNAL10_USERNAME"]!)
        let password = app.secureTextFields["password"]
        password.tap()
        password.typeText(env["SIGNAL10_PASSWORD"]!)
        snapshot("02-sign-in")
        app.buttons["signInButton"].tap()

        // The Top 10 arrives and the path starts at step 1.
        let upNext = app.buttons["upNext"]
        XCTAssertTrue(upNext.waitForExistence(timeout: 90), "results")
        XCTAssertTrue(upNext.label.contains("START HERE"), upNext.label)
        snapshot("03-results")

        app.swipeUp()
        snapshot("04-path")
        app.swipeDown()
        app.swipeDown()

        // Play step 1.
        upNext.tap()
        let markWatched = app.buttons["markWatched"]
        XCTAssertTrue(markWatched.waitForExistence(timeout: 10), "player sheet")
        XCTAssertTrue(app.navigationBars["Step 1 of 10"].exists)
        sleep(8) // let YouTube's player load before the screenshot
        snapshot("05-player")

        // Mark it watched: the sheet moves on to step 2.
        markWatched.tap()
        XCTAssertTrue(app.navigationBars["Step 2 of 10"].waitForExistence(timeout: 10))
        sleep(5)
        snapshot("06-player-next")

        // Back in the path, Up next has moved on.
        app.buttons["Done"].tap()
        XCTAssertTrue(upNext.waitForExistence(timeout: 10))
        XCTAssertTrue(upNext.label.contains("UP NEXT · STEP 2 OF 10"), upNext.label)
        snapshot("07-continue")

        app.buttons["Top 10"].tap()
        snapshot("08-top10")

        app.buttons["Architect View"].tap()
        sleep(3)
        let done = app.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout: 10))
        // Either the plan or the server's "not set up" message; give a real call time to answer.
        _ = app.staticTexts["Watch in this order"].waitForExistence(timeout: 90)
        snapshot("09-architect")
    }

    private func snapshot(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = env["SIGNAL10_SCREENSHOT_DIR"] {
            try? shot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appending(path: "\(name).png"))
        }
    }
}
