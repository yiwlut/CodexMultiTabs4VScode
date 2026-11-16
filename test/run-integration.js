"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const vscode = require("vscode");

function codexTabs() {
  return vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs
      .filter((tab) =>
        tab.input instanceof vscode.TabInputCustom &&
        tab.input.viewType === "chatgpt.conversationEditor",
      )
      .map((tab) => ({ group, tab, uri: tab.input.uri.toString() })),
  );
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out: " + description);
}

exports.run = async function run() {
  const reportPath = process.env.CODEX_MULTI_TABS_TEST_REPORT;
  assert.ok(reportPath, "A test report path is required");
  const report = { passed: false, steps: [] };
  try {
    const extension = vscode.extensions.getExtension("local.codex-multi-tabs");
    assert.ok(extension, "Local extension is loaded in the test host");
    await extension.activate();
    assert.equal(codexTabs().length, 0, "The isolated test starts without Codex editors");

    const previous = new Set();
    for (let count = 1; count <= 4; count++) {
      await vscode.commands.executeCommand("codexMultiTabs.newChatBeside");
      await waitFor(() => codexTabs().length === count, `Codex editor count ${count}`);
      const opened = codexTabs();
      const addresses = new Set(opened.map((entry) => entry.uri));
      const groups = new Set(opened.map((entry) => entry.group.viewColumn));
      assert.equal(addresses.size, count, "Each editor has a different resource URI");
      assert.equal(groups.size, count, "Each editor is in its own editor group");
      for (const uri of previous) assert.ok(addresses.has(uri), "Earlier editors stay open");
      for (const entry of opened) {
        assert.equal(entry.tab.input.uri.scheme, "openai-codex");
        assert.equal(entry.tab.input.uri.path, "/extension/panel/new");
        assert.match(entry.tab.input.uri.query, /^n=[0-9a-f-]{36}$/);
      }
      report.steps.push({
        command: "codexMultiTabs.newChatBeside",
        codexEditorCount: count,
        distinctEditorGroups: groups.size,
        distinctResources: addresses.size,
      });
      addresses.forEach((uri) => previous.add(uri));
    }

    const official = vscode.extensions.getExtension("openai.chatgpt");
    assert.ok(official?.isActive, "The real Codex editor provider is active");
    report.officialVersion = official.packageJSON.version;
    report.vscodeVersion = vscode.version;
    report.resources = codexTabs().map((entry) => entry.uri);
    report.passed = true;
    report.scope = "Real VS Code extension-host editor creation; no prompts or model turns";
  } catch (error) {
    report.error = error?.stack || String(error);
    throw error;
  } finally {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    const owned = codexTabs().map((entry) => entry.tab);
    if (owned.length) await vscode.window.tabGroups.close(owned, true);
  }
};
