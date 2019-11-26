'use strict';

import * as vscode from 'vscode';

import { A11yTreeOutlineProvider } from './a11yTreeOutline';

export function activate(context: vscode.ExtensionContext) {
	const a11yTreeOutlineProvider = new A11yTreeOutlineProvider(context);

	const a11yTree = vscode.window.createTreeView('a11yTree', {
		treeDataProvider: a11yTreeOutlineProvider
	});

	vscode.commands.registerCommand('a11yTree.refresh', () =>
		a11yTreeOutlineProvider.refresh()
	);

	vscode.commands.registerCommand('a11yTree.switch', () => {
		const title = a11yTreeOutlineProvider.switchView();

		vscode.window.showInformationMessage(`a11yTree switched to show ${title}`);
		// TODO: Used in the perposed API
		// a11yTree.message = `a11yTree ${title}`;
	});

	vscode.commands.registerCommand('extension.openA11yTreeSelection', range =>
		a11yTreeOutlineProvider.select(range)
	);
}
