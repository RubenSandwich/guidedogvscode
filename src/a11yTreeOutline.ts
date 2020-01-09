import * as vscode from 'vscode';

import * as path from 'path';

import {
  guideDog,
  GuideDogFilter,
  AccessibleNodeWithSource,
} from '@rubennic/guidedog';

type IndexPath = number[];

export class A11yTreeOutlineProvider
  implements vscode.TreeDataProvider<IndexPath> {
  private _onDidChangeTreeData: vscode.EventEmitter<IndexPath | null> = new vscode.EventEmitter<IndexPath | null>();
  readonly onDidChangeTreeData: vscode.Event<IndexPath | null> = this
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

  refresh(indexPath?: IndexPath): void {
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

  private getA11yNode(
    indexPath: number[],
    remainingTree: AccessibleNodeWithSource[] = [],
  ): AccessibleNodeWithSource {
    const index = indexPath[0];

    if (indexPath.length === 1) {
      return remainingTree[index];
    }

    return this.getA11yNode(
      indexPath.slice(1),
      remainingTree[index].children as AccessibleNodeWithSource[],
    );
  }

  // Parsing starts here, then falls back into it if TreeItem.Expanded
  getChildren(indexPath?: IndexPath): IndexPath[] {
    if (!this.tree) {
      this.parseTree();
    }

    // The inital run only goes 3 deep?
    if (indexPath) {
      const a11yNode = this.getA11yNode(indexPath, this.tree);

      const indexOfChildren = Array.from(
        Array(a11yNode.children.length).keys(),
      );

      return indexOfChildren.map(index => {
        return [...indexPath, index];
      });
    }

    return Array.from(Array(this.tree.length).keys()).map(index => {
      return [index];
    });
  }

  // required
  getTreeItem(indexPath: IndexPath): vscode.TreeItem {
    const a11yNode = this.getA11yNode(indexPath, this.tree);

    const name = a11yNode.name === '' ? a11yNode.role : a11yNode.name;

    let treeItem: vscode.TreeItem = new vscode.TreeItem(
      name,
      a11yNode.children
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );

    const { valid, invalidReason } = this.validHeaderLevel(a11yNode, indexPath);
    if (!valid) {
      treeItem.iconPath = {
        light: path.join(
          __filename,
          '..',
          '..',
          'resources',
          'light',
          'error.svg',
        ),
        dark: path.join(
          __filename,
          '..',
          '..',
          'resources',
          'light',
          'error.svg',
        ),
      };
      treeItem.tooltip = invalidReason;
    }

    if (a11yNode.level) {
      treeItem.description = `${a11yNode.role} ${a11yNode.level}`;
    } else {
      treeItem.description = a11yNode.role;
    }

    const sourceRange = new vscode.Range(
      this.editor.document.positionAt(a11yNode.sourceCodeLoc.startOffset),
      this.editor.document.positionAt(a11yNode.sourceCodeLoc.endOffset),
    );

    treeItem.command = {
      command: 'extension.openA11yTreeSelection',
      title: '',
      arguments: [sourceRange],
    };

    return treeItem;
  }

  getParent(indexPath: IndexPath): IndexPath {
    if (indexPath.length === 1) {
      return null;
    }

    return indexPath.slice(0, -1);
  }

  private numOfHeaderLevelOnes() {
    return this.tree.reduce((acc, root) => {
      if (root.level === 1) {
        return acc + 1;
      }

      return acc;
    }, 0);
  }

  private validHeaderLevel(
    a11yNode: AccessibleNodeWithSource,
    indexPath: IndexPath,
  ): { valid: boolean; invalidReason?: string } {
    const parentIndex = this.getParent(indexPath);

    if (parentIndex == null) {
      const numOfHeaderLevelOnes = this.numOfHeaderLevelOnes();

      if (numOfHeaderLevelOnes === 0) {
        return {
          valid: false,
          invalidReason: 'One <h1> should exist.',
        };
      }

      if (numOfHeaderLevelOnes != 1 && a11yNode.level == 1) {
        return {
          valid: false,
          invalidReason: 'Only one <h1> should exist.',
        };
      }

      if (a11yNode.level != 1 && a11yNode.level != 2) {
        return {
          valid: false,
          invalidReason: "Only <h1>'s and <h2>'s should be at root.",
        };
      }

      return {
        valid: true,
      };
    }

    const parentNode = this.getA11yNode(parentIndex, this.tree);
    if (parentNode.level + 1 !== a11yNode.level) {
      return {
        valid: false,
        invalidReason: `Skips a header level. Parent is <h${
          parentNode.level
        }>, so this header's level should be <h${parentNode.level + 1}>.`,
      };
    }

    return {
      valid: true,
    };
  }

  select(range: vscode.Range) {
    this.editor.selection = new vscode.Selection(range.start, range.end);
  }
}
