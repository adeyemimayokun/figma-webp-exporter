"use strict";
function isExportableNode(node) {
    return 'exportAsync' in node;
}
function getExportableSelection() {
    return [...figma.currentPage.selection].filter(isExportableNode);
}
async function exportSelection(nodes, scale) {
    const images = [];
    for (const node of nodes) {
        const bytes = await node.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: scale },
        });
        images.push({
            name: node.name,
            bytes,
            width: Math.round(node.width * scale),
            height: Math.round(node.height * scale),
        });
    }
    return images;
}
figma.showUI(__html__, { width: 320, height: 580, themeColors: true });
figma.on('selectionchange', () => {
    figma.ui.postMessage({ type: 'selection-changed' });
});
figma.ui.onmessage = async (msg) => {
    if (msg.type !== 'export' && msg.type !== 'preview') {
        return;
    }
    const nodesToExport = getExportableSelection();
    if (nodesToExport.length === 0) {
        figma.ui.postMessage({
            type: msg.type === 'preview' ? 'preview-empty' : 'error',
            message: 'Please select at least one exportable layer on the canvas.',
        });
        return;
    }
    if (nodesToExport.length > 8) {
        figma.ui.postMessage({
            type: msg.type === 'preview' ? 'preview-empty' : 'error',
            message: 'Please select a maximum of 8 layers at once.',
        });
        return;
    }
    const scale = msg.settings.scale || 1;
    const lossless = msg.settings.lossless === true;
    const quality = lossless ? 1 : (msg.settings.quality || 0.8);
    if (msg.type === 'preview') {
        try {
            const images = await exportSelection(nodesToExport, scale);
            figma.ui.postMessage({
                type: 'preview-data',
                images,
                quality,
                lossless,
            });
        }
        catch (err) {
            figma.ui.postMessage({
                type: 'preview-empty',
                message: 'Unable to preview selection.',
            });
            console.error(err);
        }
        return;
    }
    figma.ui.postMessage({ type: 'status', message: 'Extracting layers from canvas...' });
    try {
        const images = await exportSelection(nodesToExport, scale);
        figma.ui.postMessage({
            type: 'export-data',
            images,
            quality,
            lossless,
        });
    }
    catch (err) {
        figma.ui.postMessage({
            type: 'error',
            message: 'Failed to export layers. Ensure layers are valid.',
        });
        console.error(err);
    }
};
