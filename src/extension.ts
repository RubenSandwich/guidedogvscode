'use strict';

import * as vscode from 'vscode';

import { A11yTreeOutlineProvider } from './a11yTreeOutline';

const updateContext = (updateTreeType: string) => {
  vscode.commands.executeCommand(
    'setContext',
    'guide-dog-tree-Type',
    updateTreeType,
  );
};

const updateA11yTree = treeProvider => (updateTreeType: string) => {
  updateContext(updateTreeType);
  treeProvider.switchView(updateTreeType);

  vscode.workspace
    .getConfiguration('guidedog')
    .update('treeType', updateTreeType);
};

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('guidedog');

  updateContext(config.treeType);

  const a11yTreeOutlineProvider = new A11yTreeOutlineProvider(context);

  const treeView = vscode.window.createTreeView('a11yTree', {
    treeDataProvider: a11yTreeOutlineProvider,
  });

  treeView.message = config.treeType;

  vscode.commands.registerCommand('a11yTree.refresh', () =>
    a11yTreeOutlineProvider.refresh(),
  );

  // const updateA11yTreeView = updateA11yTree(a11yTreeOutlineProvider);

  // vscode.commands.registerCommand("a11yTree.switchToScreenReaderTree", () => {
  //   updateA11yTreeView("Screen Reader");
  // });

  // vscode.commands.registerCommand("a11yTree.switchToLandmarkTree", () => {
  //   updateA11yTreeView("Landmarks");
  // });

  // vscode.commands.registerCommand("a11yTree.switchToTabbableTree", () => {
  //   updateA11yTreeView("Tabbable");
  // });

  vscode.commands.registerCommand('extension.openA11yTreeSelection', range => {
    a11yTreeOutlineProvider.select(range);
  });
}
