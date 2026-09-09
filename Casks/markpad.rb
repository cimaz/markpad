# Homebrew cask for Markpad.
#
# This repo doubles as its own tap:
#
#   brew tap cimaz/markpad https://github.com/cimaz/markpad
#   brew install --cask --no-quarantine markpad
#
# `--no-quarantine` is what matters: Markpad is only ad-hoc signed (no paid
# Apple Developer account), so without it macOS Gatekeeper still asks the user
# to right-click > Open the first time.
#
# After each release, refresh `version` and the two `sha256` values with:
#   npm run cask:sha

cask "markpad" do
  version "1.0.0"

  on_arm do
    sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    url "https://github.com/cimaz/markpad/releases/download/v#{version}/Markpad-#{version}-mac-arm64.dmg",
        verified: "github.com/cimaz/markpad/"
  end
  on_intel do
    sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    url "https://github.com/cimaz/markpad/releases/download/v#{version}/Markpad-#{version}-mac-x64.dmg",
        verified: "github.com/cimaz/markpad/"
  end

  name "Markpad"
  desc "Local-first Markdown editor with a link map"
  homepage "https://github.com/cimaz/markpad"

  # GitHub releases tagged like "v1.0.0"
  livecheck do
    url :url
    strategy :github_latest
  end

  app "Markpad.app"

  zap trash: [
    "~/Library/Application Support/Markpad",
    "~/Library/Preferences/com.markpad.editor.plist",
    "~/Library/Saved Application State/com.markpad.editor.savedState",
  ]
end
