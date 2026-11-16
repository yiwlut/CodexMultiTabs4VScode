"use strict";

const vscode = require("vscode");
const { randomUUID } = require("node:crypto");

// Open only when the user invokes a command. This extension never submits a
// prompt, creates an API session, changes approval settings, or patches Codex.
async function openChat(beside) {
  const codex = vscode.extensions.getExtension("openai.chatgpt");
  if (!codex) {
    throw new Error("Install the official OpenAI Codex extension first.");
  }
  await codex.activate();

  if (beside) {
    await vscode.commands.executeCommand("workbench.action.newGroupRight");
  }
  const column = vscode.window.tabGroups.activeTabGroup.viewColumn;
  const resource = vscode.Uri.from({
    scheme: "openai-codex",
    authority: "route",
    path: "/extension/panel/new",
    query: "n=" + randomUUID(),
  });
  await vscode.commands.executeCommand(
    "vscode.openWith",
    resource,
    "chatgpt.conversationEditor",
    { viewColumn: column, preserveFocus: false, preview: false },
  );
}

function activate(context) {
  const register = (name, beside) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(name, async () => {
        try {
          await openChat(beside);
        } catch (error) {
          await vscode.window.showErrorMessage(
            "Codex Multi Tabs: " + (error?.message || String(error)),
          );
        }
      }),
    );
  };
  register("codexMultiTabs.newChat", false);
  register("codexMultiTabs.newChatBeside", true);
}

exports.activate = activate;
