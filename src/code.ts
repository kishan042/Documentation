figma.showUI(__html__, { width: 400, height: 600 });

type DetachedType = 'component' | 'variable';

interface DetachedItem {
  id: string;
  name: string;
  type: DetachedType;
  pageId: string;
  pageName: string;
  metadata?: Record<string, string>;
}

interface PageData {
  pageId: string;
  pageName: string;
  items: DetachedItem[];
}

interface SummaryData {
  totalDetachedComponents: number;
  totalDetachedVariables: number;
  pageBreakdown: PageData[];
}

function isInstanceNode(node: SceneNode): node is InstanceNode {
  return node.type === 'INSTANCE';
}

function isDetachedComponent(node: SceneNode): node is InstanceNode {
  return isInstanceNode(node) && node.mainComponent === null;
}

function extractDetachedVariables(node: SceneNode, page: PageNode): DetachedItem[] {
  const items: DetachedItem[] = [];
  if ('boundVariables' in node && node.boundVariables) {
    const boundVars = node.boundVariables as unknown as Record<string, { id?: string } | null>;
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

function getDetachedItemsForPage(page: PageNode): DetachedItem[] {
  const items: DetachedItem[] = [];
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

function scanFile(): SummaryData {
  const pages = figma.root.children as readonly PageNode[];
  const pageBreakdown: PageData[] = [];
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

function sendResultsToUI(data: SummaryData): void {
  figma.ui.postMessage({ type: 'results', data });
}

function notifyEmptyState(): void {
  figma.ui.postMessage({ type: 'results', data: { totalDetachedComponents: 0, totalDetachedVariables: 0, pageBreakdown: [] } });
}

function handleScanRequest(): void {
  try {
    const summary = scanFile();
    if (summary.pageBreakdown.length === 0) {
      notifyEmptyState();
    } else {
      sendResultsToUI(summary);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error during scan';
    figma.notify(message, { timeout: 2000 });
    figma.ui.postMessage({ type: 'error', message });
  }
}

function resolvePage(node: SceneNode): PageNode | null {
  let current: BaseNode | null = node.parent;
  while (current) {
    if (current.type === 'PAGE') {
      return current as PageNode;
    }
    current = 'parent' in current ? (current.parent as BaseNode | null) : null;
  }
  return null;
}

function focusNode(nodeId: string): void {
  const node = figma.getNodeById(nodeId) as SceneNode | null;
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

type PluginRequest =
  | { type: 'scan' }
  | { type: 'navigate'; nodeId: string }
  | { type: string; [key: string]: unknown };

figma.ui.onmessage = (pluginMessage: PluginRequest) => {
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

