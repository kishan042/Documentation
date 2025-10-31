"use strict";
figma.showUI(__html__, { width: 400, height: 600 });
function isInstanceNode(node) {
    return node.type === 'INSTANCE';
}
function isDetachedComponent(node) {
    return isInstanceNode(node) && node.mainComponent === null;
}
function extractDetachedVariables(node, page) {
    const items = [];
    if ('boundVariables' in node && node.boundVariables) {
        const boundVars = node.boundVariables;
        for (const propertyName of Object.keys(boundVars)) {
            const binding = boundVars[propertyName];
            if (!binding) {
                continue;
            }
            const variableId = typeof binding.id === 'string' ? binding.id : null;
            if (!variableId) {
                continue;
            }
            const variable = figma.variables && figma.variables.getVariableById(variableId);
            if (!variable) {
                items.push({
                    id: node.id,
                    name: `${node.name || node.type} · ${propertyName}`,
                    type: 'variable',
                    pageId: page.id,
                    pageName: page.name,
                    metadata: { property: propertyName }
                });
            }
        }
    }
    return items;
}
function getDetachedItemsForPage(page) {
    const items = [];
    const nodes = page.findAll(() => true);
    for (const node of nodes) {
        if (isDetachedComponent(node)) {
            items.push({
                id: node.id,
                name: node.name || 'Unnamed Instance',
                type: 'component',
                pageId: page.id,
                pageName: page.name
            });
        }
        const variableIssues = extractDetachedVariables(node, page);
        if (variableIssues.length > 0) {
            items.push.apply(items, variableIssues);
        }
    }
    return items;
}
function scanFile() {
    const pages = figma.root.children;
    const pageBreakdown = [];
    let totalDetachedComponents = 0;
    let totalDetachedVariables = 0;
    for (const page of pages) {
        const pageItems = getDetachedItemsForPage(page);
        if (pageItems.length > 0) {
            totalDetachedComponents += pageItems.filter(item => item.type === 'component').length;
            totalDetachedVariables += pageItems.filter(item => item.type === 'variable').length;
            pageBreakdown.push({
                pageId: page.id,
                pageName: page.name,
                items: pageItems
            });
        }
    }
    return {
        totalDetachedComponents,
        totalDetachedVariables,
        pageBreakdown
    };
}
function sendResultsToUI(data) {
    figma.ui.postMessage({ type: 'results', data });
}
function notifyEmptyState() {
    figma.ui.postMessage({ type: 'results', data: { totalDetachedComponents: 0, totalDetachedVariables: 0, pageBreakdown: [] } });
}
function handleScanRequest() {
    try {
        const summary = scanFile();
        if (summary.pageBreakdown.length === 0) {
            notifyEmptyState();
        }
        else {
            sendResultsToUI(summary);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error during scan';
        figma.notify(message, { timeout: 2000 });
        figma.ui.postMessage({ type: 'error', message });
    }
}
function resolvePage(node) {
    let current = node.parent;
    while (current) {
        if (current.type === 'PAGE') {
            return current;
        }
        current = 'parent' in current ? current.parent : null;
    }
    return null;
}
function focusNode(nodeId) {
    const node = figma.getNodeById(nodeId);
    if (!node) {
        figma.notify('Target node not found. It may have been deleted.', { timeout: 2000 });
        figma.ui.postMessage({ type: 'error', message: 'Node not found or removed.' });
        return;
    }
    const page = resolvePage(node);
    if (page) {
        figma.currentPage = page;
    }
    figma.viewport.scrollAndZoomIntoView([node]);
}
figma.ui.onmessage = (pluginMessage) => {
    if (!pluginMessage || typeof pluginMessage !== 'object') {
        return;
    }
    switch (pluginMessage.type) {
        case 'scan':
            handleScanRequest();
            break;
        case 'navigate':
            if ('nodeId' in pluginMessage && typeof pluginMessage.nodeId === 'string') {
                focusNode(pluginMessage.nodeId);
            }
            break;
        default:
            break;
    }
};
// Perform an initial scan once UI is ready
figma.on('run', () => {
    figma.ui.postMessage({ type: 'ready' });
});
