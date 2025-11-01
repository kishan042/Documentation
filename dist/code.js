"use strict";
figma.showUI(__html__, { width: 400, height: 600 });
function getInstancesForPage(page) {
    const instances = page.findAll(node => node.type === 'INSTANCE');
    const groups = new Map();
    for (const instance of instances) {
        const main = instance.mainComponent;
        if (!main) {
            continue;
        }
        const componentId = main.id;
        const groupKey = main.key || componentId;
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                componentId,
                componentKey: main.key || undefined,
                componentName: main.name || 'Unnamed Component',
                instances: []
            });
        }
        const group = groups.get(groupKey);
        group.instances.push({
            id: instance.id,
            name: instance.name || 'Instance',
            componentId,
            componentKey: main.key || undefined,
            componentName: main.name || 'Unnamed Component'
        });
    }
    const sortedGroups = Array.from(groups.values()).sort((a, b) => a.componentName.localeCompare(b.componentName));
    for (const group of sortedGroups) {
        group.instances.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sortedGroups;
}
function scanFile() {
    const pages = figma.root.children;
    const pageBreakdown = [];
    let totalInstances = 0;
    const uniqueComponentKeys = new Set();
    for (const page of pages) {
        const componentGroups = getInstancesForPage(page);
        if (componentGroups.length === 0) {
            continue;
        }
        const instanceCount = componentGroups.reduce((acc, group) => acc + group.instances.length, 0);
        totalInstances += instanceCount;
        componentGroups.forEach(group => {
            uniqueComponentKeys.add(group.componentKey || group.componentId);
        });
        pageBreakdown.push({
            pageId: page.id,
            pageName: page.name,
            instanceCount,
            componentGroups
        });
    }
    return {
        totalInstances,
        totalUniqueComponents: uniqueComponentKeys.size,
        pageBreakdown
    };
}
function sendResultsToUI(data) {
    figma.ui.postMessage({ type: 'results', data });
}
function notifyEmptyState() {
    figma.ui.postMessage({ type: 'results', data: { totalInstances: 0, totalUniqueComponents: 0, pageBreakdown: [] } });
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
