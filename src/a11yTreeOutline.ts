import * as vscode from "vscode";

import { guideDog, GuideDogFilter } from "@rubennic/guidedog";

interface a11yNode {
  html: string;
  role: string;
  name: string;
  level: number;
}

export class A11yTreeOutlineProvider
  implements vscode.TreeDataProvider<a11yNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<a11yNode | null> = new vscode.EventEmitter<a11yNode | null>();
  readonly onDidChangeTreeData: vscode.Event<a11yNode | null> = this
    ._onDidChangeTreeData.event;

  private tree: a11yNode[];
  private text: string;
  private editor: vscode.TextEditor;
  private filterType = GuideDogFilter.OnlyInteresting;

  constructor(private context: vscode.ExtensionContext) {
    vscode.window.onDidChangeActiveTextEditor(() =>
      this.onActiveEditorChanged()
    );

    vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));

    this.parseTree();
    this.onActiveEditorChanged();
  }

  refresh(a11yNode?: a11yNode): void {
    this.parseTree();
    if (a11yNode) {
      this._onDidChangeTreeData.fire(a11yNode);
    } else {
      this._onDidChangeTreeData.fire();
    }
  }

  switchView(): string {
    let title = "";

    switch (this.filterType) {
      case GuideDogFilter.OnlyInteresting: {
        title = "landmarks";
        this.filterType = GuideDogFilter.OnlyLandmarks;
        break;
      }
      case GuideDogFilter.OnlyLandmarks: {
        title = "tabbable elements";
        this.filterType = GuideDogFilter.OnlyTabableElements;
        break;
      }
      case GuideDogFilter.OnlyTabableElements: {
        title = '"interesting" elements';
        this.filterType = GuideDogFilter.OnlyInteresting;
        break;
      }
    }

    this.parseTree();
    this._onDidChangeTreeData.fire();

    return title;
  }

  private onActiveEditorChanged(): void {
    if (vscode.window.activeTextEditor) {
      if (vscode.window.activeTextEditor.document.uri.scheme === "file") {
        const enabled =
          vscode.window.activeTextEditor.document.languageId === "html";

        vscode.commands.executeCommand(
          "setContext",
          "a11yTreeEnabled",
          enabled
        );

        if (enabled) {
          this.refresh();
        }
      }
    } else {
      vscode.commands.executeCommand("setContext", "a11yTreeEnabled", false);
    }
  }

  private onDocumentChanged(changeEvent: vscode.TextDocumentChangeEvent): void {
    if (
      changeEvent.document.uri.toString() ===
      this.editor.document.uri.toString()
    ) {
      this.parseTree();
      this._onDidChangeTreeData.fire();

      // TODO: Don't reparse the whole tree
      // for (const change of changeEvent.contentChanges) {
      // 	console.log(change);
      // }
    }
  }

  private async parseTree() {
    this.text = "";
    this.tree = null;
    this.editor = vscode.window.activeTextEditor;

    if (this.editor && this.editor.document) {
      this.text = this.editor.document.getText();

      const accessibilityTree = await guideDog(this.text, {
        filterType: this.filterType
      });

      this.tree = accessibilityTree;
    }
  }

  // required
  getChildren(element?: a11yNode): Thenable<a11yNode[]> {
    this.editor = vscode.window.activeTextEditor;
    if (this.editor && this.editor.document) {
      const text = this.editor.document.getText();

      return Promise.resolve(
        guideDog(text, {
          filterType: this.filterType
        })
      );
    }

    return Promise.resolve([]);
  }

  // required
  getTreeItem(a11yNode: a11yNode): vscode.TreeItem {
    const name = a11yNode.name === "" ? a11yNode.role : a11yNode.name;
    let treeItem: vscode.TreeItem = new vscode.TreeItem(name);

    if (a11yNode.level) {
      treeItem.description = `${a11yNode.role} ${a11yNode.level}`;
    } else {
      treeItem.description = a11yNode.role;
    }

    treeItem.tooltip = a11yNode.html;

    // TODO: Doesn't take into account repeats
    const offset = this.text.indexOf(a11yNode.html);
    const length = a11yNode.html.length;

    treeItem.command = {
      command: "extension.openA11yTreeSelection",
      title: "",
      arguments: [
        new vscode.Range(
          this.editor.document.positionAt(offset),
          this.editor.document.positionAt(offset + length)
        )
      ]
    };

    return treeItem;
  }

  select(range: vscode.Range) {
    this.editor.selection = new vscode.Selection(range.start, range.end);
  }
}
