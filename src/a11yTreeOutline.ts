import * as vscode from 'vscode';

import {
  guideDog,
  GuideDogFilter,
  AccessibleNodeWithSource,
} from '@rubennic/guidedog';

export class A11yTreeOutlineProvider
  implements vscode.TreeDataProvider<AccessibleNodeWithSource> {
  private _onDidChangeTreeData: vscode.EventEmitter<AccessibleNodeWithSource | null> = new vscode.EventEmitter<AccessibleNodeWithSource | null>();
  readonly onDidChangeTreeData: vscode.Event<AccessibleNodeWithSource | null> = this
    ._onDidChangeTreeData.event;

  private tree: AccessibleNodeWithSource[];
  private text: string;
  private editor: vscode.TextEditor;
  private filterType = GuideDogFilter.Headers;

  constructor(private context: vscode.ExtensionContext) {
    vscode.window.onDidChangeActiveTextEditor(() =>
      this.onActiveEditorChanged(),
    );

    vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));

    // this.updateFilterType(treeName);
    this.onActiveEditorChanged();
  }

  refresh(a11yNode?: AccessibleNodeWithSource): void {
    this.parseTree();

    this._onDidChangeTreeData.fire();
  }

  // updateFilterType(treeType: string): void {
  //   switch (treeType) {
  //     case 'Screen Reader': {
  //       this.filterType = GuideDogFilter.OnlyInteresting;
  //       break;
  //     }
  //     case 'Landmarks': {
  //       this.filterType = GuideDogFilter.OnlyLandmarks;
  //       break;
  //     }
  //     case 'Tabbable': {
  //       this.filterType = GuideDogFilter.OnlyTabableElements;
  //       break;
  //     }
  //   }
  // }

  // switchView(treeType: string): void {
  //   this.treeName = treeType;

  //   this.updateFilterType(treeType);

  //   this.refresh();
  // }

  private onActiveEditorChanged(): void {
    if (vscode.window.activeTextEditor) {
      if (vscode.window.activeTextEditor.document.uri.scheme === 'file') {
        const enabled =
          vscode.window.activeTextEditor.document.languageId === 'html';

        vscode.commands.executeCommand(
          'setContext',
          'a11yTreeEnabled',
          enabled,
        );

        if (enabled) {
          this.refresh();
        }
      }
    } else {
      vscode.commands.executeCommand('setContext', 'a11yTreeEnabled', false);
    }
  }

  private onDocumentChanged(changeEvent: vscode.TextDocumentChangeEvent): void {
    if (
      changeEvent.document.uri.toString() ===
      this.editor.document.uri.toString()
    ) {
      this.refresh();
    }
  }

  private async parseTree() {
    this.text = '';
    this.tree = null;
    this.editor = vscode.window.activeTextEditor;

    if (this.editor && this.editor.document) {
      this.text = this.editor.document.getText();

      const accessibilityTree = guideDog(this.text, {
        filterType: this.filterType,
        sourceCodeLoc: true,
      }) as AccessibleNodeWithSource[];

      this.tree = accessibilityTree;
    }
  }

  // Parsing starts here, then falls back into it if TreeItem.Expanded
  getChildren(a11yNode?: AccessibleNodeWithSource): AccessibleNodeWithSource[] {
    if (!this.tree) {
      this.parseTree();
    }

    // Does not get called when added children to existing nodes...
    if (a11yNode) {
      if (a11yNode.children) {
        return a11yNode.children as AccessibleNodeWithSource[];
      }

      return [];
    } else {
      return this.tree;
    }
  }

  // required
  getTreeItem(a11yNode: AccessibleNodeWithSource): vscode.TreeItem {
    const name = a11yNode.name === '' ? a11yNode.role : a11yNode.name;

    let treeItem: vscode.TreeItem = new vscode.TreeItem(
      name,
      a11yNode.children
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );

    if (a11yNode.level) {
      treeItem.description = `${a11yNode.role} ${a11yNode.level}`;
    } else {
      treeItem.description = a11yNode.role;
    }

    const sourceRange = new vscode.Range(
      this.editor.document.positionAt(a11yNode.sourceCodeLoc.startOffset),
      this.editor.document.positionAt(a11yNode.sourceCodeLoc.endOffset),
    );

    // Html of the tree item
    treeItem.tooltip = this.editor.document.getText(sourceRange);

    treeItem.command = {
      command: 'extension.openA11yTreeSelection',
      title: '',
      arguments: [sourceRange],
    };

    return treeItem;
  }

  select(range: vscode.Range) {
    this.editor.selection = new vscode.Selection(range.start, range.end);
  }
}
