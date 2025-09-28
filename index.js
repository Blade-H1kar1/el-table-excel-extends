const containerSelectors = {
    body: ".el-table__body-wrapper",
    left: ".el-table__fixed .el-table__fixed-body-wrapper",
    right: ".el-table__fixed-right .el-table__fixed-body-wrapper"
};

function createCellInfo(rowIndex, columnIndex) {
    return {
        rowIndex: rowIndex,
        columnIndex: columnIndex
    };
}

function getCellText(element) {
    if (!element) return "";
    const selectTags = element.querySelector(".el-select__tags");
    if (selectTags) {
        const tagTexts = selectTags.querySelectorAll(".el-select__tags-text");
        if (tagTexts.length > 0) {
            const texts = [];
            for (let i = 0; i < tagTexts.length; i++) {
                const text = tagTexts[i].textContent?.trim();
                if (text) texts.push(text);
            }
            return texts.join(",");
        }
        return selectTags.textContent?.trim() || "";
    }
    const switchElement = element.querySelector(".el-switch");
    if (switchElement) {
        return switchElement.classList.contains("is-checked") ? "是" : "否";
    }
    const checkedRadio = element.querySelector(".el-radio.is-checked");
    if (checkedRadio) {
        const label = checkedRadio.querySelector(".el-radio__label");
        if (label) {
            const text = label.textContent?.trim();
            if (text) return text;
        }
    }
    const checkedCheckboxes = element.querySelectorAll(".el-checkbox.is-checked");
    if (checkedCheckboxes.length > 0) {
        const checkedTexts = [];
        for (let i = 0; i < checkedCheckboxes.length; i++) {
            const label = checkedCheckboxes[i].querySelector(".el-checkbox__label");
            if (label) {
                const text = label.textContent?.trim();
                if (text) checkedTexts.push(text);
            }
        }
        if (checkedTexts.length > 0) {
            return checkedTexts.join(", ");
        }
    }
    const inputs = element.querySelectorAll("input, textarea");
    if (inputs.length > 0) {
        const inputValues = [];
        for (let i = 0; i < inputs.length; i++) {
            if (inputs[i].value) {
                inputValues.push(inputs[i].value);
            }
        }
        if (inputValues.length > 0) {
            return inputValues.join(" ");
        }
    }
    const cascader = element.querySelector(".el-cascader");
    if (cascader) return;
    return element.textContent?.trim() || "";
}

function getCellIndexFromElement(cellElement, tableEl, fixedType = "body") {
    if (!cellElement || !tableEl) return null;
    const cellMap = getCachedCellMap(tableEl, fixedType);
    if (!cellMap) return null;
    for (const [key, element] of cellMap.entries()) {
        if (element === cellElement) {
            const [rowIndex, columnIndex] = key.split("-").map(Number);
            return {
                rowIndex: rowIndex,
                columnIndex: columnIndex
            };
        }
    }
    return null;
}

const cellMapCache = new WeakMap;

const CELL_MAP_CACHE_DURATION = 200;

function buildCellMap(tbody) {
    const cellMap = new Map;
    const rows = Array.from(tbody.children);
    rows.forEach((tr, rowIndex) => {
        let columnIndex = 0;
        Array.from(tr.children).forEach(cell => {
            const colspan = parseInt(cell.getAttribute("colspan") || "1");
            const rowspan = parseInt(cell.getAttribute("rowspan") || "1");
            while (cellMap.has(`${rowIndex}-${columnIndex}`)) {
                columnIndex++;
            }
            for (let r = rowIndex; r < rowIndex + rowspan; r++) {
                for (let c = columnIndex; c < columnIndex + colspan; c++) {
                    cellMap.set(`${r}-${c}`, cell);
                }
            }
            columnIndex += colspan;
        });
    });
    return cellMap;
}

function getCachedCellMap(tableEl, fixedType) {
    const now = Date.now();
    const cacheKey = `${fixedType}`;
    const cached = cellMapCache.get(tableEl);
    if (cached && cached[cacheKey] && now - cached[cacheKey].timestamp < CELL_MAP_CACHE_DURATION) {
        return cached[cacheKey].cellMap;
    }
    const tbody = tableEl.querySelector(containerSelectors[fixedType]).querySelector("tbody");
    if (!tbody) return null;
    const cellMap = buildCellMap(tbody);
    const tableCache = cached || {};
    tableCache[cacheKey] = {
        cellMap: cellMap,
        timestamp: now
    };
    cellMapCache.set(tableEl, tableCache);
    return cellMap;
}

function getCellElement(tableEl, rowIndex, columnIndex, fixedType = "body") {
    if (!tableEl) return null;
    const cellMap = getCachedCellMap(tableEl, fixedType);
    if (!cellMap) return null;
    return cellMap.get(`${rowIndex}-${columnIndex}`) || null;
}

const rectCache = new WeakMap;

const RECT_CACHE_DURATION = 200;

function getCachedBoundingClientRect(element) {
    if (!element) return null;
    const now = Date.now();
    const cached = rectCache.get(element);
    if (cached && now - cached.timestamp < RECT_CACHE_DURATION) {
        return cached.rect;
    }
    const rect = element.getBoundingClientRect();
    rectCache.set(element, {
        rect: rect,
        timestamp: now
    });
    return rect;
}

function calculateSelectionBounds(selectedCells, tableEl, fixedType = "body") {
    if (selectedCells.length === 0 || !tableEl) return null;
    const tableBodyWrapper = tableEl.querySelector(containerSelectors[fixedType]);
    if (!tableBodyWrapper) return null;
    const wrapperRect = getCachedBoundingClientRect(tableBodyWrapper);
    let scrollLeft = tableBodyWrapper.scrollLeft;
    let scrollTop = tableBodyWrapper.scrollTop;
    let minRowIndex = Infinity;
    let maxRowIndex = -Infinity;
    let minColumnIndex = Infinity;
    let maxColumnIndex = -Infinity;
    for (const cellInfo of selectedCells) {
        const {rowIndex: rowIndex, columnIndex: columnIndex} = cellInfo;
        minRowIndex = Math.min(minRowIndex, rowIndex);
        maxRowIndex = Math.max(maxRowIndex, rowIndex);
        minColumnIndex = Math.min(minColumnIndex, columnIndex);
        maxColumnIndex = Math.max(maxColumnIndex, columnIndex);
    }
    const topLeftCell = getCellElement(tableEl, minRowIndex, minColumnIndex, fixedType);
    const topRightCell = getCellElement(tableEl, minRowIndex, maxColumnIndex, fixedType);
    let bottomLeftCell = getCellElement(tableEl, maxRowIndex, minColumnIndex, fixedType);
    let bottomRightCell = getCellElement(tableEl, maxRowIndex, maxColumnIndex, fixedType);
    let searchRowIndex = maxRowIndex;
    while ((!bottomLeftCell || bottomLeftCell.offsetParent === null) && searchRowIndex > minRowIndex) {
        searchRowIndex--;
        bottomLeftCell = getCellElement(tableEl, searchRowIndex, minColumnIndex, fixedType);
    }
    searchRowIndex = maxRowIndex;
    while ((!bottomRightCell || bottomRightCell.offsetParent === null) && searchRowIndex > minRowIndex) {
        searchRowIndex--;
        bottomRightCell = getCellElement(tableEl, searchRowIndex, maxColumnIndex, fixedType);
    }
    if (!topLeftCell || !bottomRightCell) return null;
    const topLeftRect = getCachedBoundingClientRect(topLeftCell);
    const bottomRightRect = getCachedBoundingClientRect(bottomRightCell);
    let leftBound = topLeftRect.left - wrapperRect.left + scrollLeft;
    let topBound = topLeftRect.top - wrapperRect.top + scrollTop;
    let rightBound = bottomRightRect.right - wrapperRect.left + scrollLeft;
    let bottomBound = bottomRightRect.bottom - wrapperRect.top + scrollTop;
    if (topRightCell && topRightCell !== topLeftCell) {
        const topRightRect = getCachedBoundingClientRect(topRightCell);
        rightBound = Math.max(rightBound, topRightRect.right - wrapperRect.left + scrollLeft);
    }
    if (bottomLeftCell && bottomLeftCell !== topLeftCell) {
        const bottomLeftRect = getCachedBoundingClientRect(bottomLeftCell);
        bottomBound = Math.max(bottomBound, bottomLeftRect.bottom - wrapperRect.top + scrollTop);
    }
    const bounds = {
        left: leftBound,
        top: topBound,
        width: rightBound - leftBound,
        height: bottomBound - topBound
    };
    return bounds;
}

function getVisibleElements(elements, wrapperRect, direction, useBinarySearch = null) {
    if (elements.length === 0) return [];
    const viewStart = direction === "vertical" ? wrapperRect.top : wrapperRect.left;
    const viewEnd = direction === "vertical" ? wrapperRect.bottom : wrapperRect.right;
    if (useBinarySearch) {
        let left = 0, right = elements.length - 1, firstIndex = elements.length;
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const rect = getCachedBoundingClientRect(elements[mid]);
            const end = direction === "vertical" ? rect.bottom : rect.right;
            if (end > viewStart) {
                firstIndex = mid;
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        left = 0;
        right = elements.length - 1;
        let lastIndex = -1;
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const rect = getCachedBoundingClientRect(elements[mid]);
            const start = direction === "vertical" ? rect.top : rect.left;
            if (start < viewEnd) {
                lastIndex = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        const visibleElements = [];
        for (let i = firstIndex; i <= lastIndex && i < elements.length; i++) {
            const rect = getCachedBoundingClientRect(elements[i]);
            const start = direction === "vertical" ? rect.top : rect.left;
            const end = direction === "vertical" ? rect.bottom : rect.right;
            if (end > viewStart && start < viewEnd) {
                visibleElements.push({
                    index: i,
                    rect: rect
                });
            }
        }
        return visibleElements;
    } else {
        const visibleElements = [];
        for (let i = 0; i < elements.length; i++) {
            const rect = getCachedBoundingClientRect(elements[i]);
            const start = direction === "vertical" ? rect.top : rect.left;
            const end = direction === "vertical" ? rect.bottom : rect.right;
            if (end > viewStart && start < viewEnd) {
                visibleElements.push({
                    index: i,
                    rect: rect
                });
            }
        }
        return visibleElements;
    }
}

function calculateTargetIndex(mousePosition, wrapperStart, wrapperEnd, visibleElements, allElements, relativePosition, direction) {
    if (visibleElements.length === 0) {
        return direction === "horizontal" ? 0 : null;
    }
    if (mousePosition < wrapperStart) {
        return visibleElements[0].index;
    } else if (mousePosition > wrapperEnd) {
        return visibleElements[visibleElements.length - 1].index;
    }
    let targetIndex = 0;
    let currentPosition = 0;
    for (let i = 0; i < allElements.length; i++) {
        const elementRect = getCachedBoundingClientRect(allElements[i]);
        const elementSize = direction === "vertical" ? elementRect.height : elementRect.width;
        if (relativePosition <= currentPosition + elementSize) {
            targetIndex = i;
            break;
        }
        currentPosition += elementSize;
        targetIndex = i;
    }
    return Math.max(0, Math.min(targetIndex, allElements.length - 1));
}

function getCellInfoFromEvent(event, tableEl, containerType) {
    let target = event.target?.classList?.contains("el-table__cell") ? event.target : event?.target?.closest(".el-table__cell");
    if (!target) return null;
    const {rowIndex: rowIndex, columnIndex: columnIndex} = getCellIndexFromElement(target, tableEl, containerType);
    return {
        rowIndex: rowIndex,
        columnIndex: columnIndex,
        element: target
    };
}

function isInnerCell(event, tableEl) {
    if (!tableEl) return false;
    const isInner = tableEl.querySelector(".el-table").contains(event.target);
    const isEmpty = event.target.classList.contains("el-table__body-wrapper") || event.target.classList.contains("el-table__fixed-body-wrapper");
    return isInner && !isEmpty;
}

function getBoundaryCellFromMousePosition(event, tableEl) {
    if (!tableEl) return null;
    const containerInfo = detectContainerFromMousePosition(event, tableEl);
    if (!containerInfo.container) return null;
    if (isInnerCell(event, tableEl) && event.target.closest(".el-table__body")) {
        return getCellInfoFromEvent(event, tableEl, containerInfo.type);
    }
    const tbody = containerInfo.container.querySelector("tbody");
    if (!tbody) return null;
    const rows = tbody.querySelectorAll("tr");
    if (rows.length === 0) return null;
    const {relativeMouseX: relativeMouseX, relativeMouseY: relativeMouseY} = calculateRelativePosition(event, containerInfo);
    const wrapperRect = getCachedBoundingClientRect(containerInfo.container);
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const visibleRows = getVisibleElements(rows, wrapperRect, "vertical", rows.length > 100);
    const targetRowIndex = calculateTargetIndex(mouseY, wrapperRect.top, wrapperRect.bottom, visibleRows, rows, relativeMouseY, "vertical");
    if (targetRowIndex === null) {
        return null;
    }
    const targetRow = rows[targetRowIndex];
    const cells = targetRow.querySelectorAll("td");
    if (cells.length === 0) return null;
    const visibleCells = getVisibleElements(cells, wrapperRect, "horizontal", false);
    const targetColumnIndex = calculateTargetIndex(mouseX, wrapperRect.left, wrapperRect.right, visibleCells, cells, relativeMouseX, "horizontal");
    const targetCell = cells[targetColumnIndex];
    return {
        rowIndex: targetRowIndex,
        columnIndex: targetColumnIndex,
        element: targetCell,
        containerType: containerInfo.type
    };
}

function detectContainerFromMousePosition(event, tableEl) {
    const fixedLeft = tableEl.querySelector(".el-table__fixed");
    const fixedRight = tableEl.querySelector(".el-table__fixed-right");
    const bodyWrapper = tableEl.querySelector(".el-table__body-wrapper");
    const mouseX = event.clientX;
    if (fixedLeft) {
        const leftRect = getCachedBoundingClientRect(fixedLeft);
        if (mouseX <= leftRect.right) {
            const fixedBodyWrapper = fixedLeft.querySelector(".el-table__fixed-body-wrapper");
            return {
                container: fixedBodyWrapper,
                type: "left"
            };
        }
    }
    if (fixedRight) {
        const rightRect = getCachedBoundingClientRect(fixedRight);
        if (mouseX >= rightRect.left) {
            const fixedBodyWrapper = fixedRight.querySelector(".el-table__fixed-body-wrapper");
            return {
                container: fixedBodyWrapper,
                type: "right"
            };
        }
    }
    return {
        container: bodyWrapper,
        type: "body"
    };
}

function calculateRelativePosition(event, containerInfo) {
    const {container: container, type: type} = containerInfo;
    if (!container) return {
        relativeMouseX: 0,
        relativeMouseY: 0
    };
    const containerRect = getCachedBoundingClientRect(container);
    let relativeMouseX, relativeMouseY;
    if (type === "body") {
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        relativeMouseX = event.clientX - containerRect.left + scrollLeft;
        relativeMouseY = event.clientY - containerRect.top + scrollTop;
    } else {
        relativeMouseX = event.clientX - containerRect.left;
        relativeMouseY = event.clientY - containerRect.top;
    }
    return {
        relativeMouseX: relativeMouseX,
        relativeMouseY: relativeMouseY
    };
}

function getHeaderText(tableEl, columnIndex) {
    if (!tableEl) return "";
    const headerRow = tableEl.querySelector(".el-table__header-wrapper .el-table__header thead tr");
    if (!headerRow) return "";
    const headerCells = headerRow.querySelectorAll("th");
    if (columnIndex >= 0 && columnIndex < headerCells.length) {
        const headerCell = headerCells[columnIndex];
        const cellContent = headerCell.querySelector(".content");
        return cellContent ? cellContent.textContent?.trim() || "" : "";
    }
    return "";
}

function detectScrollDirection(event, tableWrapper) {
    const rect = getCachedBoundingClientRect(tableWrapper);
    const {clientX: clientX, clientY: clientY} = event;
    const edgeThreshold = 20;
    const scrollDirection = {
        up: false,
        down: false,
        left: false,
        right: false
    };
    if ((clientY < rect.top || clientY < rect.top + edgeThreshold) && tableWrapper.scrollTop > 0) {
        scrollDirection.up = true;
    } else if ((clientY > rect.bottom || clientY > rect.bottom - edgeThreshold) && tableWrapper.scrollTop < tableWrapper.scrollHeight - tableWrapper.clientHeight) {
        scrollDirection.down = true;
    }
    if ((clientX < rect.left || clientX < rect.left + edgeThreshold) && tableWrapper.scrollLeft > 0) {
        scrollDirection.left = true;
    } else if ((clientX > rect.right || clientX > rect.right - edgeThreshold) && tableWrapper.scrollLeft < tableWrapper.scrollWidth - tableWrapper.clientWidth) {
        scrollDirection.right = true;
    }
    if (scrollDirection.up || scrollDirection.down || scrollDirection.left || scrollDirection.right) {
        return scrollDirection;
    }
    return null;
}

function getCellsBounds(cells) {
    if (!cells || cells.length === 0) {
        return {
            minRow: 0,
            maxRow: 0,
            minCol: 0,
            maxCol: 0
        };
    }
    const minRow = Math.min(...cells.map(cell => cell.rowIndex));
    const maxRow = Math.max(...cells.map(cell => cell.rowIndex));
    const minCol = Math.min(...cells.map(cell => cell.columnIndex));
    const maxCol = Math.max(...cells.map(cell => cell.columnIndex));
    return {
        minRow: minRow,
        maxRow: maxRow,
        minCol: minCol,
        maxCol: maxCol
    };
}

function convertRowsToTableData(rows) {
    const rowIndices = Object.keys(rows).map(Number).sort((a, b) => a - b);
    const tableData = [];
    rowIndices.forEach(rowIndex => {
        const row = rows[rowIndex];
        const colIndices = Object.keys(row).map(Number).sort((a, b) => a - b);
        const minCol = Math.min(...colIndices);
        const maxCol = Math.max(...colIndices);
        const rowData = [];
        for (let col = minCol; col <= maxCol; col++) {
            rowData.push(row[col] || "");
        }
        tableData.push(rowData);
    });
    const textData = tableData.map(row => row.join("\t")).join("\n");
    return {
        tableData: tableData,
        textData: textData
    };
}

function getColumnCount(tableEl) {
    if (!tableEl) return 0;
    return tableEl.querySelector(".el-table__header thead").querySelectorAll("th").length;
}

async function readClipboardData(applicationType) {
    try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
            if (item.types.includes(applicationType)) {
                const jsonData = JSON.parse(await (await item.getType(applicationType)).text());
                if (jsonData.type === "super-crud-data" && jsonData.data) {
                    return {
                        textData: jsonData.data.textData,
                        isInternal: true
                    };
                }
            }
        }
        for (const item of clipboardItems) {
            if (item.types.includes("text/plain")) {
                const textData = await (await item.getType("text/plain")).text();
                return {
                    textData: textData,
                    isInternal: false
                };
            }
        }
        return {
            textData: "",
            isInternal: false
        };
    } catch (error) {
        console.warn("读取多格式剪贴板数据失败，尝试文本模式:", error);
        const textData = await navigator.clipboard.readText();
        return {
            textData: textData,
            isInternal: false
        };
    }
}

function findComponentInstance(instance, componentName, maxDepth = 3, direction = "both") {
    if (!instance) return;
    let currentDepth = 0;
    const componentNames = Array.isArray(componentName) ? componentName : [ componentName ];
    const isNameMatch = name => componentNames.includes(name);
    const findDown = (instance, depth = 0) => {
        if (!instance || depth >= maxDepth) return;
        const name = instance.$options.name;
        if (name && isNameMatch(name)) return instance;
        const children = instance.$children || [];
        for (const child of children) {
            const result = findDown(child, depth + 1);
            if (result) return result;
        }
    };
    const findUp = (instance, depth = 0) => {
        if (!instance || depth >= maxDepth) return;
        const name = instance.$options.name;
        if (name && isNameMatch(name)) return instance;
        const parent = instance.$parent;
        if (parent) {
            return findUp(parent, depth + 1);
        }
    };
    const currentName = instance.$options.name;
    if (currentName && isNameMatch(currentName)) {
        return instance;
    }
    if (direction === "both" || direction === "down") {
        const downResult = findDown(instance, currentDepth);
        if (downResult) return downResult;
    }
    if (direction === "both" || direction === "up") {
        const upResult = findUp(instance, currentDepth);
        if (upResult) return upResult;
    }
    return undefined;
}

function toTreeArray(tree, options = {}) {
    if (!Array.isArray(tree)) {
        return [];
    }
    const config = {
        children: "children",
        strict: false,
        mapChildren: null,
        ...options
    };
    const result = [];
    function traverse(nodes, level = 0, parent = null) {
        if (!Array.isArray(nodes)) {
            return;
        }
        nodes.forEach((node, index) => {
            if (!node || typeof node !== "object") {
                return;
            }
            const nodeItem = config.strict ? {
                ...node
            } : node;
            if (!config.strict) {
                nodeItem.$level = level;
                nodeItem.$index = index;
                if (parent) {
                    nodeItem.$parent = parent;
                }
            }
            const children = node[config.children];
            if (config.strict && Array.isArray(children)) {
                delete nodeItem[config.children];
            }
            result.push(nodeItem);
            if (Array.isArray(children) && children.length > 0) {
                const childrenToProcess = config.mapChildren ? children.map(config.mapChildren) : children;
                traverse(childrenToProcess, level + 1, nodeItem);
            }
        });
    }
    traverse(tree);
    return result;
}

class UndoRedoManager {
    constructor(options = {}) {
        this.stack = [];
        this.maxSize = options.maxSize || 50;
        this.isRecording = true;
        this.currentIndex = -1;
    }
    recordHistory(operationType, affectedCells) {
        if (!this.isRecording || !affectedCells || affectedCells.length === 0) {
            return;
        }
        const historyRecord = {
            operationType: operationType,
            affectedCells: affectedCells.map(cell => ({
                rowIndex: cell.rowIndex,
                columnIndex: cell.columnIndex,
                oldValue: cell.oldValue,
                newValue: cell.newValue
            }))
        };
        if (this.currentIndex < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.currentIndex + 1);
        }
        this.stack.push(historyRecord);
        this.currentIndex = this.stack.length - 1;
        if (this.stack.length > this.maxSize) {
            this.stack.shift();
            this.currentIndex--;
        }
    }
    executeUndo() {
        if (this.currentIndex < 0) {
            console.warn("没有可撤销的操作");
            return {
                affectedCells: null,
                operationType: "undo"
            };
        }
        const undoRecord = this.stack[this.currentIndex];
        if (!undoRecord) return null;
        this.currentIndex--;
        this.isRecording = false;
        try {
            const {affectedCells: affectedCells} = undoRecord;
            return {
                affectedCells: affectedCells,
                operationType: "undo"
            };
        } catch (error) {
            console.error("撤销操作失败:", error);
            return null;
        } finally {
            this.isRecording = true;
        }
    }
    executeRedo() {
        if (this.currentIndex >= this.stack.length - 1) {
            console.warn("没有可重做的操作");
            return {
                affectedCells: null,
                operationType: "redo"
            };
        }
        this.currentIndex++;
        const redoRecord = this.stack[this.currentIndex];
        if (!redoRecord) return null;
        this.isRecording = false;
        try {
            const {affectedCells: affectedCells} = redoRecord;
            return {
                affectedCells: affectedCells,
                operationType: "redo"
            };
        } catch (error) {
            console.error("重做操作失败:", error);
            return null;
        } finally {
            this.isRecording = true;
        }
    }
    canUndo() {
        return this.currentIndex >= 0;
    }
    canRedo() {
        return this.currentIndex < this.stack.length - 1;
    }
    clear() {
        this.stack = [];
        this.currentIndex = -1;
    }
    getHistoryInfo() {
        return {
            stackLength: this.stack.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}

class OverlayManager {
    constructor({tableEl: tableEl, initCallback: initCallback = () => {}}) {
        this.tableEl = tableEl;
        this.initCallback = initCallback;
        this.overlays = {
            body: {
                selection: {
                    element: null,
                    visible: false
                },
                copyDash: {
                    element: null,
                    visible: false
                },
                extended: {
                    element: null,
                    visible: false
                }
            },
            left: {
                selection: {
                    element: null,
                    visible: false
                },
                copyDash: {
                    element: null,
                    visible: false
                },
                extended: {
                    element: null,
                    visible: false
                }
            },
            right: {
                selection: {
                    element: null,
                    visible: false
                },
                copyDash: {
                    element: null,
                    visible: false
                },
                extended: {
                    element: null,
                    visible: false
                }
            }
        };
        this.OVERLAY_TYPES = [ "selection", "copyDash", "extended" ];
        this.CONTAINER_TYPES = [ "body", "left", "right" ];
        this.CLASS_NAMES = {
            selection: "cell-selection-overlay",
            copyDash: "copy-dash-overlay",
            extended: "extended-selection-overlay"
        };
        this.CONTAINER_SELECTORS = {
            body: ".el-table__body-wrapper",
            left: ".el-table__fixed .el-table__fixed-body-wrapper",
            right: ".el-table__fixed-right .el-table__fixed-body-wrapper"
        };
        this.mutationObserver = null;
        this.isDestroyed = false;
        this.initOverlays();
        this.initOverlayObserver();
    }
    getAvailableContainers() {
        if (!this.tableEl) return [ "body" ];
        const containers = [ "body" ];
        const leftFixed = this.tableEl.querySelector(".el-table__fixed .el-table__fixed-body-wrapper");
        if (leftFixed) {
            containers.push("left");
        }
        const rightFixed = this.tableEl.querySelector(".el-table__fixed-right .el-table__fixed-body-wrapper");
        if (rightFixed) {
            containers.push("right");
        }
        return containers;
    }
    initOverlays() {
        this.cleanupOverlays();
        const containers = this.getAvailableContainers();
        containers.forEach(containerType => {
            this.OVERLAY_TYPES.forEach(overlayType => {
                this.createOverlay(overlayType, containerType);
            });
        });
        this.initCallback();
    }
    initOverlayObserver() {
        if (!this.tableEl || this.isDestroyed) return;
        this.destroyOverlayObserver();
        this.mutationObserver = new MutationObserver(mutations => {
            if (this.isDestroyed) return;
            let needReinit = false;
            mutations.forEach(mutation => {
                if (mutation.type === "childList") {
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const isTableElement = node.classList && node.classList.contains("el-table");
                            const containsTable = node.querySelector && node.querySelector(".el-table");
                            if (isTableElement || containsTable) {
                                needReinit = true;
                            }
                        }
                    });
                }
            });
            if (needReinit) {
                setTimeout(() => {
                    if (!this.isDestroyed && !this.hasExistingOverlays()) {
                        this.initOverlays();
                    }
                }, 100);
            }
        });
        this.mutationObserver.observe(this.tableEl, {
            childList: true,
            subtree: true
        });
    }
    destroyOverlayObserver() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
    }
    hasExistingOverlays() {
        if (!this.tableEl) return false;
        for (const overlayType of this.OVERLAY_TYPES) {
            const className = this.CLASS_NAMES[overlayType];
            if (this.tableEl.querySelector(`.${className}`)) {
                return true;
            }
        }
        return false;
    }
    createOverlay(type, containerType = "body") {
        if (!this.tableEl) return;
        const container = this.tableEl.querySelector(this.CONTAINER_SELECTORS[containerType]);
        if (!container) return;
        const overlay = document.createElement("div");
        overlay.className = `${this.CLASS_NAMES[type]} ${this.CLASS_NAMES[type]}--${containerType}`;
        container.appendChild(overlay);
        this.overlays[containerType][type].element = overlay;
        if (type === "selection") {
            this.createFillHandle(overlay);
        }
    }
    createFillHandle(selectionOverlay) {
        const fillHandle = document.createElement("div");
        fillHandle.className = "fill-handle";
        selectionOverlay.appendChild(fillHandle);
    }
    showOverlay(type, bounds = null, containerType = "body") {
        const overlay = this.overlays[containerType][type];
        if (!overlay.element) return;
        if (bounds) {
            this.updateOverlayPosition(type, bounds, containerType);
        }
        overlay.element.style.display = "block";
        overlay.visible = true;
    }
    hideOverlay(type, containerType = "body") {
        const overlay = this.overlays[containerType][type];
        if (!overlay.element) return;
        overlay.element.style.display = "none";
        overlay.visible = false;
    }
    hideAllOverlays(type) {
        const containers = this.getAvailableContainers();
        containers.forEach(containerType => {
            this.hideOverlay(type, containerType);
        });
    }
    getContainersForCells(selectedCells) {
        if (!selectedCells || selectedCells.length === 0) return [];
        if (!this.tableEl) return [ "body" ];
        const availableContainers = this.getAvailableContainers();
        const neededContainers = new Set;
        selectedCells.forEach(cellInfo => {
            const {rowIndex: rowIndex, columnIndex: columnIndex} = cellInfo;
            availableContainers.forEach(containerType => {
                const cellElement = this.getCellElementInContainer(rowIndex, columnIndex, containerType);
                if (cellElement) {
                    neededContainers.add(containerType);
                }
            });
        });
        return Array.from(neededContainers);
    }
    updateOverlayPosition(type, bounds, containerType = "body") {
        const overlay = this.overlays[containerType][type].element;
        if (!overlay) return;
        const {left: left, top: top, width: width, height: height} = bounds;
        overlay.style.left = left + "px";
        overlay.style.top = top + "px";
        overlay.style.width = width + "px";
        overlay.style.height = height + "px";
    }
    updateOverlayForType(type, cells) {
        this.hideAllOverlays(type);
        if (!cells || cells.length === 0) return;
        const neededContainers = this.getContainersForCells(cells);
        neededContainers.forEach(containerType => {
            const bounds = this.calculateSelectionBounds(cells, containerType);
            if (bounds) {
                this.showOverlay(type, bounds, containerType);
            }
        });
    }
    calculateSelectionBounds(cells, containerType = "body") {
        if (!this.tableEl || !cells || cells.length === 0) return null;
        const validCells = cells.filter(cell => this.getCellElementInContainer(cell.rowIndex, cell.columnIndex, containerType));
        if (validCells.length === 0) return null;
        return calculateSelectionBounds(validCells, this.tableEl, containerType);
    }
    getCellElementInContainer(rowIndex, columnIndex, containerType) {
        if (!this.tableEl) return null;
        return getCellElement(this.tableEl, rowIndex, columnIndex, containerType);
    }
    cleanupOverlays() {
        this.CONTAINER_TYPES.forEach(containerType => {
            this.OVERLAY_TYPES.forEach(overlayType => {
                const overlay = this.overlays[containerType][overlayType];
                if (overlay.element) {
                    overlay.element.remove();
                    overlay.element = null;
                    overlay.visible = false;
                }
            });
        });
    }
    destroy() {
        this.isDestroyed = true;
        this.cleanupOverlays();
        this.destroyOverlayObserver();
        this.tableEl = null;
        this.overlays = null;
    }
    getFillHandle() {
        const selectionOverlay = this.overlays.body.selection.element;
        if (!selectionOverlay) return null;
        return selectionOverlay.querySelector(".fill-handle");
    }
    isOverlayVisible(type, containerType = "body") {
        return this.overlays[containerType][type].visible;
    }
    getOverlayElement(type, containerType = "body") {
        return this.overlays[containerType][type].element;
    }
}

class CellObserver {
    constructor({updated: updated, tableEl: tableEl}) {
        this.tableEl = tableEl;
        this.updated = updated;
        this.resizeObserver = null;
        this.observedElements = new Set;
        this.currentSelectedCells = [];
        this.currentCopiedCells = [];
    }
    startObserving(cells, type = "selected") {
        if (type === "selected") {
            this.currentSelectedCells = cells || [];
        } else if (type === "copied") {
            this.currentCopiedCells = cells || [];
        }
        this.updateObserverElements();
    }
    updateObserverElements() {
        const allCells = [ ...this.currentSelectedCells, ...this.currentCopiedCells ];
        if (allCells.length === 0) {
            this.stopObserving();
            return;
        }
        const topRowCellsMap = new Map;
        const selectedTopRow = this.getTopRowCells(this.currentSelectedCells);
        const copiedTopRow = this.getTopRowCells(this.currentCopiedCells);
        [ ...selectedTopRow, ...copiedTopRow ].forEach(cell => {
            const key = `${cell.rowIndex}-${cell.columnIndex}`;
            topRowCellsMap.set(key, cell);
        });
        const topRowCells = Array.from(topRowCellsMap.values());
        const maxObserveCount = 20;
        const cellsToObserve = topRowCells.slice(0, maxObserveCount);
        this.createResizeObserver(cellsToObserve);
    }
    getTopRowCells(cells) {
        if (!cells || cells.length === 0) return [];
        const minRowIndex = Math.min(...cells.map(cell => cell.rowIndex));
        Math.min(...cells.map(cell => cell.columnIndex));
        [ ...new Set(cells.map(cell => cell.rowIndex)) ];
        const columnIndexes = [ ...new Set(cells.map(cell => cell.columnIndex)) ];
        const resultCells = [];
        const cellMap = new Set;
        columnIndexes.forEach(colIndex => {
            const key = `${minRowIndex}-${colIndex}`;
            if (!cellMap.has(key)) {
                resultCells.push({
                    rowIndex: minRowIndex,
                    columnIndex: colIndex
                });
                cellMap.add(key);
            }
        });
        return resultCells;
    }
    createResizeObserver(cells) {
        this.stopObserving();
        if (cells.length === 0) return;
        this.resizeObserver = new ResizeObserver(entries => {
            this.updated();
        });
        const tbody = this.tableEl?.querySelector("tbody");
        if (tbody) {
            this.resizeObserver.observe(tbody);
            this.observedElements.add(tbody);
        }
        cells.forEach(cell => {
            const element = getCellElement(this.tableEl, cell.rowIndex, cell.columnIndex);
            if (element) {
                this.resizeObserver.observe(element);
                this.observedElements.add(element);
            }
        });
    }
    needsObserverUpdate(newCells, type = "selected") {
        const currentCells = type === "selected" ? this.currentSelectedCells : this.currentCopiedCells;
        if (!currentCells || currentCells.length !== (newCells?.length || 0)) {
            return true;
        }
        const currentSet = new Set(currentCells.map(cell => `${cell.rowIndex}-${cell.columnIndex}`));
        const newSet = new Set((newCells || []).map(cell => `${cell.rowIndex}-${cell.columnIndex}`));
        if (currentSet.size !== newSet.size) {
            return true;
        }
        for (const key of currentSet) {
            if (!newSet.has(key)) {
                return true;
            }
        }
        return false;
    }
    stopObserving() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.observedElements.clear();
        this.currentSelectedCells = [];
        this.currentCopiedCells = [];
    }
    destroy() {
        this.stopObserving();
    }
    isObserving() {
        return this.resizeObserver !== null && this.observedElements.size > 0;
    }
    getObservedCount() {
        return this.observedElements.size;
    }
}

var freeGlobal = typeof global == "object" && global && global.Object === Object && global;

var freeSelf = typeof self == "object" && self && self.Object === Object && self;

var root = freeGlobal || freeSelf || Function("return this")();

var Symbol = root.Symbol;

var objectProto$5 = Object.prototype;

var hasOwnProperty$4 = objectProto$5.hasOwnProperty;

var nativeObjectToString$1 = objectProto$5.toString;

var symToStringTag$1 = Symbol ? Symbol.toStringTag : undefined;

function getRawTag(value) {
    var isOwn = hasOwnProperty$4.call(value, symToStringTag$1), tag = value[symToStringTag$1];
    try {
        value[symToStringTag$1] = undefined;
        var unmasked = true;
    } catch (e) {}
    var result = nativeObjectToString$1.call(value);
    if (unmasked) {
        if (isOwn) {
            value[symToStringTag$1] = tag;
        } else {
            delete value[symToStringTag$1];
        }
    }
    return result;
}

var objectProto$4 = Object.prototype;

var nativeObjectToString = objectProto$4.toString;

function objectToString(value) {
    return nativeObjectToString.call(value);
}

var nullTag = "[object Null]", undefinedTag = "[object Undefined]";

var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

function baseGetTag(value) {
    if (value == null) {
        return value === undefined ? undefinedTag : nullTag;
    }
    return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
}

function isObjectLike(value) {
    return value != null && typeof value == "object";
}

var symbolTag = "[object Symbol]";

function isSymbol(value) {
    return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
}

function arrayMap(array, iteratee) {
    var index = -1, length = array == null ? 0 : array.length, result = Array(length);
    while (++index < length) {
        result[index] = iteratee(array[index], index, array);
    }
    return result;
}

var isArray = Array.isArray;

var symbolProto = Symbol ? Symbol.prototype : undefined, symbolToString = symbolProto ? symbolProto.toString : undefined;

function baseToString(value) {
    if (typeof value == "string") {
        return value;
    }
    if (isArray(value)) {
        return arrayMap(value, baseToString) + "";
    }
    if (isSymbol(value)) {
        return symbolToString ? symbolToString.call(value) : "";
    }
    var result = value + "";
    return result == "0" && 1 / value == -Infinity ? "-0" : result;
}

function isObject(value) {
    var type = typeof value;
    return value != null && (type == "object" || type == "function");
}

var asyncTag = "[object AsyncFunction]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", proxyTag = "[object Proxy]";

function isFunction(value) {
    if (!isObject(value)) {
        return false;
    }
    var tag = baseGetTag(value);
    return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

var coreJsData = root["__core-js_shared__"];

var maskSrcKey = function() {
    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
    return uid ? "Symbol(src)_1." + uid : "";
}();

function isMasked(func) {
    return !!maskSrcKey && maskSrcKey in func;
}

var funcProto$1 = Function.prototype;

var funcToString$1 = funcProto$1.toString;

function toSource(func) {
    if (func != null) {
        try {
            return funcToString$1.call(func);
        } catch (e) {}
        try {
            return func + "";
        } catch (e) {}
    }
    return "";
}

var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

var reIsHostCtor = /^\[object .+?Constructor\]$/;

var funcProto = Function.prototype, objectProto$3 = Object.prototype;

var funcToString = funcProto.toString;

var hasOwnProperty$3 = objectProto$3.hasOwnProperty;

var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty$3).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");

function baseIsNative(value) {
    if (!isObject(value) || isMasked(value)) {
        return false;
    }
    var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
    return pattern.test(toSource(value));
}

function getValue(object, key) {
    return object == null ? undefined : object[key];
}

function getNative(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : undefined;
}

var defineProperty = function() {
    try {
        var func = getNative(Object, "defineProperty");
        func({}, "", {});
        return func;
    } catch (e) {}
}();

var MAX_SAFE_INTEGER = 9007199254740991;

var reIsUint = /^(?:0|[1-9]\d*)$/;

function isIndex(value, length) {
    var type = typeof value;
    length = length == null ? MAX_SAFE_INTEGER : length;
    return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
}

function baseAssignValue(object, key, value) {
    if (key == "__proto__" && defineProperty) {
        defineProperty(object, key, {
            configurable: true,
            enumerable: true,
            value: value,
            writable: true
        });
    } else {
        object[key] = value;
    }
}

function eq(value, other) {
    return value === other || value !== value && other !== other;
}

var objectProto$2 = Object.prototype;

var hasOwnProperty$2 = objectProto$2.hasOwnProperty;

function assignValue(object, key, value) {
    var objValue = object[key];
    if (!(hasOwnProperty$2.call(object, key) && eq(objValue, value)) || value === undefined && !(key in object)) {
        baseAssignValue(object, key, value);
    }
}

var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/;

function isKey(value, object) {
    if (isArray(value)) {
        return false;
    }
    var type = typeof value;
    if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
        return true;
    }
    return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
}

var nativeCreate = getNative(Object, "create");

function hashClear() {
    this.__data__ = nativeCreate ? nativeCreate(null) : {};
    this.size = 0;
}

function hashDelete(key) {
    var result = this.has(key) && delete this.__data__[key];
    this.size -= result ? 1 : 0;
    return result;
}

var HASH_UNDEFINED$1 = "__lodash_hash_undefined__";

var objectProto$1 = Object.prototype;

var hasOwnProperty$1 = objectProto$1.hasOwnProperty;

function hashGet(key) {
    var data = this.__data__;
    if (nativeCreate) {
        var result = data[key];
        return result === HASH_UNDEFINED$1 ? undefined : result;
    }
    return hasOwnProperty$1.call(data, key) ? data[key] : undefined;
}

var objectProto = Object.prototype;

var hasOwnProperty = objectProto.hasOwnProperty;

function hashHas(key) {
    var data = this.__data__;
    return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
}

var HASH_UNDEFINED = "__lodash_hash_undefined__";

function hashSet(key, value) {
    var data = this.__data__;
    this.size += this.has(key) ? 0 : 1;
    data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED : value;
    return this;
}

function Hash(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
    }
}

Hash.prototype.clear = hashClear;

Hash.prototype["delete"] = hashDelete;

Hash.prototype.get = hashGet;

Hash.prototype.has = hashHas;

Hash.prototype.set = hashSet;

function listCacheClear() {
    this.__data__ = [];
    this.size = 0;
}

function assocIndexOf(array, key) {
    var length = array.length;
    while (length--) {
        if (eq(array[length][0], key)) {
            return length;
        }
    }
    return -1;
}

var arrayProto = Array.prototype;

var splice = arrayProto.splice;

function listCacheDelete(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    if (index < 0) {
        return false;
    }
    var lastIndex = data.length - 1;
    if (index == lastIndex) {
        data.pop();
    } else {
        splice.call(data, index, 1);
    }
    --this.size;
    return true;
}

function listCacheGet(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    return index < 0 ? undefined : data[index][1];
}

function listCacheHas(key) {
    return assocIndexOf(this.__data__, key) > -1;
}

function listCacheSet(key, value) {
    var data = this.__data__, index = assocIndexOf(data, key);
    if (index < 0) {
        ++this.size;
        data.push([ key, value ]);
    } else {
        data[index][1] = value;
    }
    return this;
}

function ListCache(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
    }
}

ListCache.prototype.clear = listCacheClear;

ListCache.prototype["delete"] = listCacheDelete;

ListCache.prototype.get = listCacheGet;

ListCache.prototype.has = listCacheHas;

ListCache.prototype.set = listCacheSet;

var Map$1 = getNative(root, "Map");

function mapCacheClear() {
    this.size = 0;
    this.__data__ = {
        hash: new Hash,
        map: new (Map$1 || ListCache),
        string: new Hash
    };
}

function isKeyable(value) {
    var type = typeof value;
    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
}

function getMapData(map, key) {
    var data = map.__data__;
    return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
}

function mapCacheDelete(key) {
    var result = getMapData(this, key)["delete"](key);
    this.size -= result ? 1 : 0;
    return result;
}

function mapCacheGet(key) {
    return getMapData(this, key).get(key);
}

function mapCacheHas(key) {
    return getMapData(this, key).has(key);
}

function mapCacheSet(key, value) {
    var data = getMapData(this, key), size = data.size;
    data.set(key, value);
    this.size += data.size == size ? 0 : 1;
    return this;
}

function MapCache(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
    }
}

MapCache.prototype.clear = mapCacheClear;

MapCache.prototype["delete"] = mapCacheDelete;

MapCache.prototype.get = mapCacheGet;

MapCache.prototype.has = mapCacheHas;

MapCache.prototype.set = mapCacheSet;

var FUNC_ERROR_TEXT = "Expected a function";

function memoize(func, resolver) {
    if (typeof func != "function" || resolver != null && typeof resolver != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
    }
    var memoized = function() {
        var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
        if (cache.has(key)) {
            return cache.get(key);
        }
        var result = func.apply(this, args);
        memoized.cache = cache.set(key, result) || cache;
        return result;
    };
    memoized.cache = new (memoize.Cache || MapCache);
    return memoized;
}

memoize.Cache = MapCache;

var MAX_MEMOIZE_SIZE = 500;

function memoizeCapped(func) {
    var result = memoize(func, function(key) {
        if (cache.size === MAX_MEMOIZE_SIZE) {
            cache.clear();
        }
        return key;
    });
    var cache = result.cache;
    return result;
}

var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

var reEscapeChar = /\\(\\)?/g;

var stringToPath = memoizeCapped(function(string) {
    var result = [];
    if (string.charCodeAt(0) === 46) {
        result.push("");
    }
    string.replace(rePropName, function(match, number, quote, subString) {
        result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
    });
    return result;
});

function toString(value) {
    return value == null ? "" : baseToString(value);
}

function castPath(value, object) {
    if (isArray(value)) {
        return value;
    }
    return isKey(value, object) ? [ value ] : stringToPath(toString(value));
}

function toKey(value) {
    if (typeof value == "string" || isSymbol(value)) {
        return value;
    }
    var result = value + "";
    return result == "0" && 1 / value == -Infinity ? "-0" : result;
}

function baseGet(object, path) {
    path = castPath(path, object);
    var index = 0, length = path.length;
    while (object != null && index < length) {
        object = object[toKey(path[index++])];
    }
    return index && index == length ? object : undefined;
}

function get(object, path, defaultValue) {
    var result = object == null ? undefined : baseGet(object, path);
    return result === undefined ? defaultValue : result;
}

function baseSet(object, path, value, customizer) {
    if (!isObject(object)) {
        return object;
    }
    path = castPath(path, object);
    var index = -1, length = path.length, lastIndex = length - 1, nested = object;
    while (nested != null && ++index < length) {
        var key = toKey(path[index]), newValue = value;
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            return object;
        }
        if (index != lastIndex) {
            var objValue = nested[key];
            newValue = undefined;
            if (newValue === undefined) {
                newValue = isObject(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {};
            }
        }
        assignValue(nested, key, newValue);
        nested = nested[key];
    }
    return object;
}

function set(object, path, value) {
    return object == null ? object : baseSet(object, path, value);
}

var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};

function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}

var dayjs_min = {
    exports: {}
};

(function(module, exports) {
    !function(t, e) {
        module.exports = e();
    }(commonjsGlobal, function() {
        var t = 1e3, e = 6e4, n = 36e5, r = "millisecond", i = "second", s = "minute", u = "hour", a = "day", o = "week", c = "month", f = "quarter", h = "year", d = "date", l = "Invalid Date", $ = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, y = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, M = {
            name: "en",
            weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
            months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
            ordinal: function(t) {
                var e = [ "th", "st", "nd", "rd" ], n = t % 100;
                return "[" + t + (e[(n - 20) % 10] || e[n] || e[0]) + "]";
            }
        }, m = function(t, e, n) {
            var r = String(t);
            return !r || r.length >= e ? t : "" + Array(e + 1 - r.length).join(n) + t;
        }, v = {
            s: m,
            z: function(t) {
                var e = -t.utcOffset(), n = Math.abs(e), r = Math.floor(n / 60), i = n % 60;
                return (e <= 0 ? "+" : "-") + m(r, 2, "0") + ":" + m(i, 2, "0");
            },
            m: function t(e, n) {
                if (e.date() < n.date()) return -t(n, e);
                var r = 12 * (n.year() - e.year()) + (n.month() - e.month()), i = e.clone().add(r, c), s = n - i < 0, u = e.clone().add(r + (s ? -1 : 1), c);
                return +(-(r + (n - i) / (s ? i - u : u - i)) || 0);
            },
            a: function(t) {
                return t < 0 ? Math.ceil(t) || 0 : Math.floor(t);
            },
            p: function(t) {
                return {
                    M: c,
                    y: h,
                    w: o,
                    d: a,
                    D: d,
                    h: u,
                    m: s,
                    s: i,
                    ms: r,
                    Q: f
                }[t] || String(t || "").toLowerCase().replace(/s$/, "");
            },
            u: function(t) {
                return void 0 === t;
            }
        }, g = "en", D = {};
        D[g] = M;
        var p = "$isDayjsObject", S = function(t) {
            return t instanceof _ || !(!t || !t[p]);
        }, w = function t(e, n, r) {
            var i;
            if (!e) return g;
            if ("string" == typeof e) {
                var s = e.toLowerCase();
                D[s] && (i = s), n && (D[s] = n, i = s);
                var u = e.split("-");
                if (!i && u.length > 1) return t(u[0]);
            } else {
                var a = e.name;
                D[a] = e, i = a;
            }
            return !r && i && (g = i), i || !r && g;
        }, O = function(t, e) {
            if (S(t)) return t.clone();
            var n = "object" == typeof e ? e : {};
            return n.date = t, n.args = arguments, new _(n);
        }, b = v;
        b.l = w, b.i = S, b.w = function(t, e) {
            return O(t, {
                locale: e.$L,
                utc: e.$u,
                x: e.$x,
                $offset: e.$offset
            });
        };
        var _ = function() {
            function M(t) {
                this.$L = w(t.locale, null, true), this.parse(t), this.$x = this.$x || t.x || {}, 
                this[p] = true;
            }
            var m = M.prototype;
            return m.parse = function(t) {
                this.$d = function(t) {
                    var e = t.date, n = t.utc;
                    if (null === e) return new Date(NaN);
                    if (b.u(e)) return new Date;
                    if (e instanceof Date) return new Date(e);
                    if ("string" == typeof e && !/Z$/i.test(e)) {
                        var r = e.match($);
                        if (r) {
                            var i = r[2] - 1 || 0, s = (r[7] || "0").substring(0, 3);
                            return n ? new Date(Date.UTC(r[1], i, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, s)) : new Date(r[1], i, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, s);
                        }
                    }
                    return new Date(e);
                }(t), this.init();
            }, m.init = function() {
                var t = this.$d;
                this.$y = t.getFullYear(), this.$M = t.getMonth(), this.$D = t.getDate(), this.$W = t.getDay(), 
                this.$H = t.getHours(), this.$m = t.getMinutes(), this.$s = t.getSeconds(), this.$ms = t.getMilliseconds();
            }, m.$utils = function() {
                return b;
            }, m.isValid = function() {
                return !(this.$d.toString() === l);
            }, m.isSame = function(t, e) {
                var n = O(t);
                return this.startOf(e) <= n && n <= this.endOf(e);
            }, m.isAfter = function(t, e) {
                return O(t) < this.startOf(e);
            }, m.isBefore = function(t, e) {
                return this.endOf(e) < O(t);
            }, m.$g = function(t, e, n) {
                return b.u(t) ? this[e] : this.set(n, t);
            }, m.unix = function() {
                return Math.floor(this.valueOf() / 1e3);
            }, m.valueOf = function() {
                return this.$d.getTime();
            }, m.startOf = function(t, e) {
                var n = this, r = !!b.u(e) || e, f = b.p(t), l = function(t, e) {
                    var i = b.w(n.$u ? Date.UTC(n.$y, e, t) : new Date(n.$y, e, t), n);
                    return r ? i : i.endOf(a);
                }, $ = function(t, e) {
                    return b.w(n.toDate()[t].apply(n.toDate("s"), (r ? [ 0, 0, 0, 0 ] : [ 23, 59, 59, 999 ]).slice(e)), n);
                }, y = this.$W, M = this.$M, m = this.$D, v = "set" + (this.$u ? "UTC" : "");
                switch (f) {
                  case h:
                    return r ? l(1, 0) : l(31, 11);

                  case c:
                    return r ? l(1, M) : l(0, M + 1);

                  case o:
                    var g = this.$locale().weekStart || 0, D = (y < g ? y + 7 : y) - g;
                    return l(r ? m - D : m + (6 - D), M);

                  case a:
                  case d:
                    return $(v + "Hours", 0);

                  case u:
                    return $(v + "Minutes", 1);

                  case s:
                    return $(v + "Seconds", 2);

                  case i:
                    return $(v + "Milliseconds", 3);

                  default:
                    return this.clone();
                }
            }, m.endOf = function(t) {
                return this.startOf(t, false);
            }, m.$set = function(t, e) {
                var n, o = b.p(t), f = "set" + (this.$u ? "UTC" : ""), l = (n = {}, n[a] = f + "Date", 
                n[d] = f + "Date", n[c] = f + "Month", n[h] = f + "FullYear", n[u] = f + "Hours", 
                n[s] = f + "Minutes", n[i] = f + "Seconds", n[r] = f + "Milliseconds", n)[o], $ = o === a ? this.$D + (e - this.$W) : e;
                if (o === c || o === h) {
                    var y = this.clone().set(d, 1);
                    y.$d[l]($), y.init(), this.$d = y.set(d, Math.min(this.$D, y.daysInMonth())).$d;
                } else l && this.$d[l]($);
                return this.init(), this;
            }, m.set = function(t, e) {
                return this.clone().$set(t, e);
            }, m.get = function(t) {
                return this[b.p(t)]();
            }, m.add = function(r, f) {
                var d, l = this;
                r = Number(r);
                var $ = b.p(f), y = function(t) {
                    var e = O(l);
                    return b.w(e.date(e.date() + Math.round(t * r)), l);
                };
                if ($ === c) return this.set(c, this.$M + r);
                if ($ === h) return this.set(h, this.$y + r);
                if ($ === a) return y(1);
                if ($ === o) return y(7);
                var M = (d = {}, d[s] = e, d[u] = n, d[i] = t, d)[$] || 1, m = this.$d.getTime() + r * M;
                return b.w(m, this);
            }, m.subtract = function(t, e) {
                return this.add(-1 * t, e);
            }, m.format = function(t) {
                var e = this, n = this.$locale();
                if (!this.isValid()) return n.invalidDate || l;
                var r = t || "YYYY-MM-DDTHH:mm:ssZ", i = b.z(this), s = this.$H, u = this.$m, a = this.$M, o = n.weekdays, c = n.months, f = n.meridiem, h = function(t, n, i, s) {
                    return t && (t[n] || t(e, r)) || i[n].slice(0, s);
                }, d = function(t) {
                    return b.s(s % 12 || 12, t, "0");
                }, $ = f || function(t, e, n) {
                    var r = t < 12 ? "AM" : "PM";
                    return n ? r.toLowerCase() : r;
                };
                return r.replace(y, function(t, r) {
                    return r || function(t) {
                        switch (t) {
                          case "YY":
                            return String(e.$y).slice(-2);

                          case "YYYY":
                            return b.s(e.$y, 4, "0");

                          case "M":
                            return a + 1;

                          case "MM":
                            return b.s(a + 1, 2, "0");

                          case "MMM":
                            return h(n.monthsShort, a, c, 3);

                          case "MMMM":
                            return h(c, a);

                          case "D":
                            return e.$D;

                          case "DD":
                            return b.s(e.$D, 2, "0");

                          case "d":
                            return String(e.$W);

                          case "dd":
                            return h(n.weekdaysMin, e.$W, o, 2);

                          case "ddd":
                            return h(n.weekdaysShort, e.$W, o, 3);

                          case "dddd":
                            return o[e.$W];

                          case "H":
                            return String(s);

                          case "HH":
                            return b.s(s, 2, "0");

                          case "h":
                            return d(1);

                          case "hh":
                            return d(2);

                          case "a":
                            return $(s, u, true);

                          case "A":
                            return $(s, u, false);

                          case "m":
                            return String(u);

                          case "mm":
                            return b.s(u, 2, "0");

                          case "s":
                            return String(e.$s);

                          case "ss":
                            return b.s(e.$s, 2, "0");

                          case "SSS":
                            return b.s(e.$ms, 3, "0");

                          case "Z":
                            return i;
                        }
                        return null;
                    }(t) || i.replace(":", "");
                });
            }, m.utcOffset = function() {
                return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
            }, m.diff = function(r, d, l) {
                var $, y = this, M = b.p(d), m = O(r), v = (m.utcOffset() - this.utcOffset()) * e, g = this - m, D = function() {
                    return b.m(y, m);
                };
                switch (M) {
                  case h:
                    $ = D() / 12;
                    break;

                  case c:
                    $ = D();
                    break;

                  case f:
                    $ = D() / 3;
                    break;

                  case o:
                    $ = (g - v) / 6048e5;
                    break;

                  case a:
                    $ = (g - v) / 864e5;
                    break;

                  case u:
                    $ = g / n;
                    break;

                  case s:
                    $ = g / e;
                    break;

                  case i:
                    $ = g / t;
                    break;

                  default:
                    $ = g;
                }
                return l ? $ : b.a($);
            }, m.daysInMonth = function() {
                return this.endOf(c).$D;
            }, m.$locale = function() {
                return D[this.$L];
            }, m.locale = function(t, e) {
                if (!t) return this.$L;
                var n = this.clone(), r = w(t, e, true);
                return r && (n.$L = r), n;
            }, m.clone = function() {
                return b.w(this.$d, this);
            }, m.toDate = function() {
                return new Date(this.valueOf());
            }, m.toJSON = function() {
                return this.isValid() ? this.toISOString() : null;
            }, m.toISOString = function() {
                return this.$d.toISOString();
            }, m.toString = function() {
                return this.$d.toUTCString();
            }, M;
        }(), k = _.prototype;
        return O.prototype = k, [ [ "$ms", r ], [ "$s", i ], [ "$m", s ], [ "$H", u ], [ "$W", a ], [ "$M", c ], [ "$y", h ], [ "$D", d ] ].forEach(function(t) {
            k[t[1]] = function(e) {
                return this.$g(e, t[0], t[1]);
            };
        }), O.extend = function(t, e) {
            return t.$i || (t(e, _, O), t.$i = true), O;
        }, O.locale = w, O.isDayjs = S, O.unix = function(t) {
            return O(1e3 * t);
        }, O.en = D[g], O.Ls = D, O.p = {}, O;
    });
})(dayjs_min);

var dayjs_minExports = dayjs_min.exports;

var dayjs = getDefaultExportFromCjs(dayjs_minExports);

const DATE_FORMATS = [ "YYYY-MM-DD", "YYYY/MM/DD" ];

function analyzePattern(sourceData, customLists = []) {
    if (!sourceData || sourceData.length === 0) {
        return {
            type: "copy",
            confidence: 1
        };
    }
    const values = sourceData.map(item => item.value).filter(v => v !== null && v !== undefined && v !== "");
    if (values.length < 2) {
        return {
            type: "copy",
            confidence: 1
        };
    }
    const numericPattern = detectNumericSequence(values);
    if (numericPattern.confidence > .8) {
        return numericPattern;
    }
    const customListPattern = detectCustomListSequence(values, customLists);
    if (customListPattern.confidence > .8) {
        return customListPattern;
    }
    const textNumericPattern = detectTextNumericSequence(values);
    if (textNumericPattern.confidence > .8) {
        return textNumericPattern;
    }
    const datePattern = detectDateSequence(values);
    if (datePattern.confidence > .8) {
        return datePattern;
    }
    return {
        type: "copy",
        confidence: 1
    };
}

function detectNumericSequence(values) {
    const numbers = [];
    for (const value of values) {
        const num = parseFloat(value);
        if (isNaN(num)) {
            return {
                type: "copy",
                confidence: 0
            };
        }
        numbers.push(num);
    }
    if (numbers.length < 2) {
        return {
            type: "copy",
            confidence: 0
        };
    }
    const differences = [];
    for (let i = 1; i < numbers.length; i++) {
        differences.push(numbers[i] - numbers[i - 1]);
    }
    const firstDiff = differences[0];
    const isArithmetic = differences.every(diff => Math.abs(diff - firstDiff) < 1e-10);
    if (isArithmetic && firstDiff !== 0) {
        return {
            type: "numeric",
            subType: "arithmetic",
            step: firstDiff,
            startValue: numbers[0],
            confidence: .9
        };
    }
    if (numbers.every(n => n !== 0)) {
        const ratios = [];
        for (let i = 1; i < numbers.length; i++) {
            ratios.push(numbers[i] / numbers[i - 1]);
        }
        const firstRatio = ratios[0];
        const isGeometric = ratios.every(ratio => Math.abs(ratio - firstRatio) < 1e-10);
        if (isGeometric && firstRatio !== 1 && firstRatio > 0) {
            return {
                type: "numeric",
                subType: "geometric",
                ratio: firstRatio,
                startValue: numbers[0],
                confidence: .85
            };
        }
    }
    return {
        type: "copy",
        confidence: 0
    };
}

function detectTextNumericSequence(values) {
    const textNumPattern = /^(.+?)(\d+)$/;
    const extractedData = [];
    for (const value of values) {
        const match = String(value).match(textNumPattern);
        if (!match) {
            return {
                type: "copy",
                confidence: 0
            };
        }
        const textPart = match[1];
        const numPart = parseInt(match[2], 10);
        extractedData.push({
            text: textPart,
            number: numPart,
            original: value
        });
    }
    if (extractedData.length < 2) {
        return {
            type: "copy",
            confidence: 0
        };
    }
    const firstText = extractedData[0].text;
    const allTextSame = extractedData.every(item => item.text === firstText);
    if (!allTextSame) {
        return {
            type: "copy",
            confidence: 0
        };
    }
    const numbers = extractedData.map(item => item.number);
    const differences = [];
    for (let i = 1; i < numbers.length; i++) {
        differences.push(numbers[i] - numbers[i - 1]);
    }
    const firstDiff = differences[0];
    const isArithmetic = differences.every(diff => diff === firstDiff);
    if (isArithmetic && firstDiff !== 0) {
        return {
            type: "textNumeric",
            textPart: firstText,
            step: firstDiff,
            startNumber: numbers[0],
            confidence: .9
        };
    }
    return {
        type: "copy",
        confidence: 0
    };
}

function detectCustomListSequence(values, customLists) {
    if (values.length < 2 || !Array.isArray(customLists)) {
        return {
            type: "copy",
            confidence: 0
        };
    }
    for (let i = 0; i < customLists.length; i++) {
        const listItems = customLists[i];
        if (Array.isArray(listItems)) {
            const pattern = matchCustomList(values, listItems, `list_${i}`);
            if (pattern.confidence > .8) {
                return pattern;
            }
        }
    }
    return {
        type: "copy",
        confidence: 0
    };
}

function matchCustomList(values, listItems, listName) {
    const indices = [];
    for (const value of values) {
        const index = listItems.findIndex(item => item === value);
        if (index === -1) {
            return {
                type: "copy",
                confidence: 0
            };
        }
        indices.push(index);
    }
    if (indices.length < 2) {
        return {
            type: "copy",
            confidence: 0
        };
    }
    const differences = [];
    for (let i = 1; i < indices.length; i++) {
        differences.push(indices[i] - indices[i - 1]);
    }
    const firstDiff = differences[0];
    const isConsecutive = differences.every(diff => diff === firstDiff);
    if (isConsecutive && firstDiff !== 0) {
        return {
            type: "customList",
            listName: listName,
            listItems: listItems,
            step: firstDiff,
            startIndex: indices[0],
            confidence: .95
        };
    }
    return {
        type: "copy",
        confidence: 0
    };
}

function detectDateSequence(values) {
    const dates = [];
    let detectedFormat = null;
    for (const value of values) {
        let parsedDate = null;
        for (const format of DATE_FORMATS) {
            const date = dayjs(value, format, true);
            if (date.isValid()) {
                parsedDate = date;
                detectedFormat = format;
                break;
            }
        }
        if (!parsedDate) {
            return {
                type: "copy",
                confidence: 0
            };
        }
        dates.push(parsedDate);
    }
    if (dates.length < 2) {
        return {
            type: "copy",
            confidence: 0
        };
    }
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
        const diff = dates[i].diff(dates[i - 1], "day");
        intervals.push(diff);
    }
    const firstInterval = intervals[0];
    const isConsistent = intervals.every(interval => interval === firstInterval);
    if (isConsistent && firstInterval !== 0) {
        return {
            type: "date",
            unit: "day",
            step: firstInterval,
            startDate: dates[0],
            format: detectedFormat,
            confidence: .9
        };
    }
    return {
        type: "copy",
        confidence: 0
    };
}

function generateSmartFillData(pattern, sourceData, fillCells, originalBounds, disableSmartFill = false) {
    if (disableSmartFill) {
        return generateCopyPattern(sourceData, fillCells, originalBounds);
    }
    switch (pattern.type) {
      case "numeric":
        return generateNumericSequence(pattern, sourceData, fillCells, originalBounds);

      case "customList":
        return generateCustomListSequence(pattern, sourceData, fillCells, originalBounds);

      case "textNumeric":
        return generateTextNumericSequence(pattern, sourceData, fillCells, originalBounds);

      case "date":
        return generateDateSequence(pattern, sourceData, fillCells, originalBounds);

      default:
        return generateCopyPattern(sourceData, fillCells, originalBounds);
    }
}

function generateNumericSequence(pattern, sourceData, fillCells, originalBounds) {
    const fillData = [];
    const {minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol} = originalBounds;
    fillCells.forEach(cell => {
        const {rowIndex: rowIndex, columnIndex: columnIndex} = cell;
        if (rowIndex >= minRow && rowIndex <= maxRow && columnIndex >= minCol && columnIndex <= maxCol) {
            return;
        }
        let sequenceIndex;
        if (rowIndex > maxRow) {
            sequenceIndex = sourceData.length + (rowIndex - maxRow - 1);
        } else if (rowIndex < minRow) {
            sequenceIndex = -(minRow - rowIndex);
        } else if (columnIndex > maxCol) {
            sequenceIndex = sourceData.length + (columnIndex - maxCol - 1);
        } else if (columnIndex < minCol) {
            sequenceIndex = -(minCol - columnIndex);
        } else {
            return;
        }
        let value;
        if (pattern.subType === "arithmetic") {
            value = pattern.startValue + sequenceIndex * pattern.step;
        } else if (pattern.subType === "geometric") {
            value = pattern.startValue * Math.pow(pattern.ratio, sequenceIndex);
        } else {
            return;
        }
        if (Number.isInteger(pattern.startValue) && Number.isInteger(pattern.step || pattern.ratio)) {
            value = Math.round(value);
        }
        fillData.push({
            rowIndex: rowIndex,
            columnIndex: columnIndex,
            value: value.toString(),
            sourceValue: pattern.startValue,
            sourceRow: minRow,
            sourceCol: minCol
        });
    });
    return fillData;
}

function generateDateSequence(pattern, sourceData, fillCells, originalBounds) {
    const fillData = [];
    const {minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol} = originalBounds;
    fillCells.forEach(cell => {
        const {rowIndex: rowIndex, columnIndex: columnIndex} = cell;
        if (rowIndex >= minRow && rowIndex <= maxRow && columnIndex >= minCol && columnIndex <= maxCol) {
            return;
        }
        let sequenceIndex;
        if (rowIndex > maxRow) {
            sequenceIndex = sourceData.length + (rowIndex - maxRow - 1);
        } else if (rowIndex < minRow) {
            sequenceIndex = -(minRow - rowIndex);
        } else if (columnIndex > maxCol) {
            sequenceIndex = sourceData.length + (columnIndex - maxCol - 1);
        } else if (columnIndex < minCol) {
            sequenceIndex = -(minCol - columnIndex);
        } else {
            return;
        }
        const newDate = pattern.startDate.add(sequenceIndex * pattern.step, pattern.unit);
        const value = newDate.format(pattern.format);
        fillData.push({
            rowIndex: rowIndex,
            columnIndex: columnIndex,
            value: value,
            sourceValue: pattern.startDate.format(pattern.format),
            sourceRow: minRow,
            sourceCol: minCol
        });
    });
    return fillData;
}

function generateCustomListSequence(pattern, sourceData, fillCells, originalBounds) {
    const fillData = [];
    const {minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol} = originalBounds;
    const {listItems: listItems, step: step, startIndex: startIndex} = pattern;
    fillCells.forEach(cell => {
        const {rowIndex: rowIndex, columnIndex: columnIndex} = cell;
        if (rowIndex >= minRow && rowIndex <= maxRow && columnIndex >= minCol && columnIndex <= maxCol) {
            return;
        }
        let sequenceIndex;
        if (rowIndex > maxRow) {
            sequenceIndex = sourceData.length + (rowIndex - maxRow - 1);
        } else if (rowIndex < minRow) {
            sequenceIndex = -(minRow - rowIndex);
        } else if (columnIndex > maxCol) {
            sequenceIndex = sourceData.length + (columnIndex - maxCol - 1);
        } else if (columnIndex < minCol) {
            sequenceIndex = -(minCol - columnIndex);
        } else {
            return;
        }
        let newIndex = startIndex + sequenceIndex * step;
        while (newIndex < 0) {
            newIndex += listItems.length;
        }
        newIndex = newIndex % listItems.length;
        const value = listItems[newIndex];
        fillData.push({
            rowIndex: rowIndex,
            columnIndex: columnIndex,
            value: value,
            sourceValue: listItems[startIndex],
            sourceRow: minRow,
            sourceCol: minCol
        });
    });
    return fillData;
}

function generateTextNumericSequence(pattern, sourceData, fillCells, originalBounds) {
    const fillData = [];
    const {minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol} = originalBounds;
    fillCells.forEach(cell => {
        const {rowIndex: rowIndex, columnIndex: columnIndex} = cell;
        if (rowIndex >= minRow && rowIndex <= maxRow && columnIndex >= minCol && columnIndex <= maxCol) {
            return;
        }
        let sequenceIndex;
        if (rowIndex > maxRow) {
            sequenceIndex = sourceData.length + (rowIndex - maxRow - 1);
        } else if (rowIndex < minRow) {
            sequenceIndex = -(minRow - rowIndex);
        } else if (columnIndex > maxCol) {
            sequenceIndex = sourceData.length + (columnIndex - maxCol - 1);
        } else if (columnIndex < minCol) {
            sequenceIndex = -(minCol - columnIndex);
        } else {
            return;
        }
        const newNumber = pattern.startNumber + sequenceIndex * pattern.step;
        const value = pattern.textPart + newNumber;
        fillData.push({
            rowIndex: rowIndex,
            columnIndex: columnIndex,
            value: value,
            sourceValue: pattern.textPart + pattern.startNumber,
            sourceRow: minRow,
            sourceCol: minCol
        });
    });
    return fillData;
}

function generateCopyPattern(sourceData, fillCells, originalBounds) {
    const fillData = [];
    const {minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol} = originalBounds;
    const sourceRows = maxRow - minRow + 1;
    const sourceCols = maxCol - minCol + 1;
    fillCells.forEach(cell => {
        const {rowIndex: rowIndex, columnIndex: columnIndex} = cell;
        if (rowIndex >= minRow && rowIndex <= maxRow && columnIndex >= minCol && columnIndex <= maxCol) {
            return;
        }
        const sourceRowIndex = Math.abs(rowIndex - minRow) % sourceRows;
        const sourceColIndex = Math.abs(columnIndex - minCol) % sourceCols;
        const sourceCell = sourceData.find(data => data.relativeRow === sourceRowIndex && data.relativeCol === sourceColIndex);
        if (sourceCell) {
            fillData.push({
                rowIndex: rowIndex,
                columnIndex: columnIndex,
                value: sourceCell.value,
                sourceValue: sourceCell.value,
                sourceRow: sourceCell.rowIndex,
                sourceCol: sourceCell.columnIndex
            });
        }
    });
    return fillData;
}

var dataProcessor = {
    computed: {
        tableData() {
            const tableRef = findComponentInstance(this, "ElTable");
            return tableRef?.data || [];
        },
        flatTableData() {
            return toTreeArray(this.tableData);
        },
        rowCount() {
            return this.flatTableData?.length || 0;
        }
    },
    methods: {
        getCellElement(rowIndex, columnIndex) {
            return getCellElement(this.getTableElement(), rowIndex, columnIndex);
        },
        getColumnByIndex(columnIndex) {
            const tableRef = findComponentInstance(this, "ElTable");
            const {store: store} = tableRef;
            const columns = store.states.columns || store.states._columns;
            return columns[columnIndex] || null;
        },
        getRowDataByIndex(rowIndex) {
            return this.flatTableData[rowIndex];
        },
        getCellComponentInstance(rowIndex, columnIndex) {
            const cellElement = getCellElement(this.getTableElement(), rowIndex, columnIndex);
            const tableRef = findComponentInstance(this, "ElTable");
            const tableChildren = tableRef.$children;
            if (!tableChildren) return;
            const tbodyInstance = tableChildren[tableChildren.length - 1];
            if (!tbodyInstance) return;
            const rowInstance = tbodyInstance.$children[rowIndex];
            if (!rowInstance) return;
            const cellInstances = rowInstance.$children;
            for (let i = 0; i < cellInstances.length; i++) {
                const cellInstance = cellInstances[i];
                if (cellElement.contains(cellInstance.$el) || cellInstance.$el === cellElement) {
                    return cellInstance;
                }
            }
        },
        setByProp(obj, prop, val) {
            if (!prop) return;
            const path = Array.isArray(prop) ? prop : prop.split(".");
            if (path.length > 1) {
                if (!get(obj, path)) {
                    path.slice(0, -1).reduce((obj, key, index) => {
                        if (!obj[key] || typeof obj[key] !== "object") {
                            this.$set(obj, key, {});
                        }
                        return obj[key];
                    }, obj);
                    const parentObj = path.slice(0, -1).reduce((obj, key) => obj[key], obj);
                    this.$set(parentObj, path[path.length - 1], val);
                } else {
                    set(obj, path, val);
                    this.$set(obj, path[0], obj[path[0]]);
                }
            } else {
                this.$set(obj, prop, val);
            }
        },
        getCellValue(rowIndex, columnIndex, type) {
            try {
                const row = this.getRowDataByIndex(rowIndex);
                const column = this.getColumnByIndex(columnIndex);
                if (!row || !column) return null;
                const prop = column?.property;
                if (this.getCellValueMethod) {
                    return this.getCellValueMethod({
                        row: row,
                        column: column,
                        rowIndex: rowIndex,
                        columnIndex: columnIndex,
                        value: prop && get(row, prop),
                        type: type
                    });
                }
                if (!prop) return null;
                return get(row, prop);
            } catch (error) {
                console.error(`获取单元格值失败 (${rowIndex}, ${columnIndex}):`, error);
                return null;
            }
        },
        setCellValue(rowIndex, columnIndex, value, type) {
            try {
                const row = this.getRowDataByIndex(rowIndex);
                const column = this.getColumnByIndex(columnIndex);
                const prop = column?.property;
                if (!row || !column || !prop) return false;
                if (this.setCellValueMethod) {
                    this.setCellValueMethod({
                        row: row,
                        column: column,
                        rowIndex: rowIndex,
                        columnIndex: columnIndex,
                        value: value,
                        type: type
                    }, this.setByProp.bind(this));
                    return true;
                }
                this.setByProp(row, prop, value);
                return true;
            } catch (error) {
                console.error(`应用单元格数据失败 (${rowIndex}, ${columnIndex}):`, error);
                return false;
            }
        },
        setClearValue(rowIndex, columnIndex) {
            const oldValue = this.getCellValue(rowIndex, columnIndex, "clear");
            const getClearValueByType = (value, rowIndex, columnIndex) => {
                if (this.getClearValueMethod) {
                    const customClearValue = this.getClearValueMethod({
                        value: value,
                        rowIndex: rowIndex,
                        columnIndex: columnIndex,
                        row: this.getRowDataByIndex(rowIndex),
                        column: this.getColumnByIndex(columnIndex)
                    });
                    if (customClearValue !== undefined) {
                        return customClearValue;
                    }
                }
                if (value === null || value === undefined) {
                    return null;
                }
                if (typeof value === "number") {
                    return 0;
                }
                if (typeof value === "boolean") {
                    return false;
                }
                if (Array.isArray(value)) {
                    return [];
                }
                if (typeof value === "object" && !(value instanceof Date)) {
                    return {};
                }
                if (value instanceof Date) {
                    return null;
                }
                return "";
            };
            const clearValue = getClearValueByType(oldValue, rowIndex, columnIndex);
            const success = this.setCellValue(rowIndex, columnIndex, clearValue, "clear");
            if (success) {
                return {
                    oldValue: oldValue,
                    clearValue: clearValue
                };
            }
            return {
                oldValue: oldValue,
                clearValue: null
            };
        },
        parseJSONValue(value) {
            let finalValue = value.trim();
            if (typeof finalValue === "string" && finalValue.trim()) {
                try {
                    if (finalValue.startsWith("{") || finalValue.startsWith("[")) {
                        finalValue = JSON.parse(finalValue);
                    } else {
                        return finalValue;
                    }
                } catch (parseError) {
                    console.error(`解析 JSON 值失败: ${parseError.message}`);
                    return finalValue;
                }
            }
            return finalValue;
        },
        applyTextValueMapping(value, rowIndex, columnIndex) {
            try {
                if (this.textMappingConfig && Object.keys(this.textMappingConfig).length) {
                    const column = this.getColumnByIndex(columnIndex);
                    const columnMapping = this.textMappingConfig[column.property];
                    if (Array.isArray(columnMapping)) {
                        const matchedItem = columnMapping.find(item => item && typeof item === "object" && (item.label === value || item.text === value || item.name === value));
                        if (matchedItem) return matchedItem.value;
                        return value;
                    }
                    if (typeof columnMapping === "object") {
                        if (columnMapping.hasOwnProperty(value)) {
                            return columnMapping[value];
                        }
                    }
                }
                if (this.customMapping) {
                    const column = this.getColumnByIndex(columnIndex);
                    const cellInstance = this.getCellComponentInstance(rowIndex, columnIndex);
                    return this.customMapping({
                        value: value,
                        column: column,
                        rowIndex: rowIndex,
                        columnIndex: columnIndex
                    }, cellInstance);
                }
                return value;
            } catch (error) {
                console.error(`文本值映射失败: ${error.message}`);
                return value;
            }
        },
        parseClipboardData(clipboardText, startRowIndex = 0, startColumnIndex = 0) {
            if (!clipboardText || typeof clipboardText !== "string") {
                return [];
            }
            const lines = clipboardText.split(/\r?\n/).filter(line => line.trim() !== "");
            const parsedData = [];
            lines.forEach((line, rowOffset) => {
                const cells = line.split("\t");
                cells.forEach((cellValue, colOffset) => {
                    parsedData.push({
                        value: cellValue,
                        rowIndex: startRowIndex + rowOffset,
                        columnIndex: startColumnIndex + colOffset,
                        originalRowOffset: rowOffset,
                        originalColumnOffset: colOffset
                    });
                });
            });
            return parsedData;
        },
        getClipboardDataDimensions(clipboardText) {
            if (!clipboardText || typeof clipboardText !== "string") {
                return {
                    rows: 0,
                    columns: 0
                };
            }
            const lines = clipboardText.split(/\r?\n/).filter(line => line.trim() !== "");
            const rows = lines.length;
            const columns = lines.length > 0 ? Math.max(...lines.map(line => line.split("\t").length)) : 0;
            return {
                rows: rows,
                columns: columns
            };
        },
        calculatePasteDataWithFill(clipboardData, clipboardDimensions, selectionBounds) {
            const {rows: clipRows, columns: clipCols} = clipboardDimensions;
            const {minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol} = selectionBounds;
            const selectionRows = maxRow - minRow + 1;
            const selectionCols = maxCol - minCol + 1;
            if (selectionRows === 1 && selectionCols === 1) {
                return clipboardData.map(cell => ({
                    ...cell,
                    rowIndex: minRow + cell.originalRowOffset,
                    columnIndex: minCol + cell.originalColumnOffset
                }));
            }
            const rowMultiplier = selectionRows % clipRows === 0 ? selectionRows / clipRows : 1;
            const colMultiplier = selectionCols % clipCols === 0 ? selectionCols / clipCols : 1;
            const filledData = [];
            for (let rowRepeat = 0; rowRepeat < rowMultiplier; rowRepeat++) {
                for (let colRepeat = 0; colRepeat < colMultiplier; colRepeat++) {
                    clipboardData.forEach(cell => {
                        const newRowIndex = minRow + rowRepeat * clipRows + cell.originalRowOffset;
                        const newColumnIndex = minCol + colRepeat * clipCols + cell.originalColumnOffset;
                        if (newRowIndex <= maxRow && newColumnIndex <= maxCol) {
                            filledData.push({
                                ...cell,
                                rowIndex: newRowIndex,
                                columnIndex: newColumnIndex
                            });
                        }
                    });
                }
            }
            return filledData;
        },
        applyPasteData(pasteData, selectedCells, isInternal = false) {
            const selectionBounds = getCellsBounds(selectedCells);
            const clipboardData = this.parseClipboardData(pasteData, selectionBounds.minRow, selectionBounds.minCol);
            if (clipboardData.length === 0) {
                return {
                    success: false,
                    message: "剪贴板数据为空"
                };
            }
            const clipboardDimensions = this.getClipboardDataDimensions(pasteData);
            pasteData = this.calculatePasteDataWithFill(clipboardData, clipboardDimensions, selectionBounds);
            const affectedCells = [];
            pasteData.forEach(cell => {
                try {
                    const {rowIndex: rowIndex, columnIndex: columnIndex, value: value} = cell;
                    const oldValue = this.getCellValue(rowIndex, columnIndex, "undo");
                    let processedValue = this.parseJSONValue(value);
                    if (!isInternal) {
                        processedValue = this.applyTextValueMapping(processedValue, rowIndex, columnIndex);
                    }
                    const success = this.setCellValue(rowIndex, columnIndex, processedValue, "paste");
                    if (success) {
                        affectedCells.push({
                            rowIndex: rowIndex,
                            columnIndex: columnIndex,
                            oldValue: oldValue,
                            newValue: processedValue
                        });
                    }
                } catch (error) {
                    console.error(cell, `单元格黏贴出错: ${error.message}`);
                }
            });
            return {
                affectedCells: affectedCells,
                pasteBounds: getCellsBounds(affectedCells)
            };
        },
        performFillOperation(originalBounds, fillCells, fillDirection, disableSmartFill = false) {
            const sourceData = this.getSourceDataForFill(originalBounds);
            const fillData = this.generateSmartFillData(sourceData, originalBounds, fillCells, disableSmartFill);
            const {affectedCells: affectedCells, fillBounds: fillBounds} = this.applyFillData(fillData);
            if (affectedCells && affectedCells.length > 0) {
                this.recordUndoHistory("fill", affectedCells);
            }
            return {
                affectedCells: affectedCells,
                fillBounds: fillBounds,
                sourceData: sourceData,
                fillData: fillData
            };
        },
        getSourceDataForFill(originalBounds) {
            const sourceData = [];
            const {minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol} = originalBounds;
            for (let row = minRow; row <= maxRow; row++) {
                for (let col = minCol; col <= maxCol; col++) {
                    const value = this.getCellValue(row, col, "fill");
                    sourceData.push({
                        rowIndex: row,
                        columnIndex: col,
                        value: value,
                        relativeRow: row - minRow,
                        relativeCol: col - minCol
                    });
                }
            }
            return sourceData;
        },
        generateSmartFillData(sourceData, originalBounds, fillCells, disableSmartFill = false) {
            const pattern = analyzePattern(sourceData, this.areaSelection.fillCustomLists || {});
            return generateSmartFillData(pattern, sourceData, fillCells, originalBounds, disableSmartFill);
        },
        applyFillData(fillData) {
            const affectedCells = [];
            fillData.forEach(data => {
                try {
                    const {rowIndex: rowIndex, columnIndex: columnIndex, value: value} = data;
                    const oldValue = this.getCellValue(rowIndex, columnIndex, "undo");
                    const success = this.setCellValue(rowIndex, columnIndex, value, "fill");
                    if (success) {
                        affectedCells.push({
                            rowIndex: rowIndex,
                            columnIndex: columnIndex,
                            oldValue: oldValue,
                            newValue: value,
                            originalValue: value,
                            sourceValue: data.sourceValue
                        });
                    }
                } catch (error) {
                    console.error(data, `单元格填充出错: ${error.message}`);
                }
            });
            return {
                affectedCells: affectedCells,
                fillBounds: getCellsBounds(affectedCells)
            };
        }
    }
};

const applicationType = "web application/super-crud-data";

var script = {
    mixins: [ dataProcessor ],
    props: {
        copy: {
            type: Boolean,
            default: true
        },
        paste: {
            type: Boolean,
            default: true
        },
        cut: {
            type: Boolean,
            default: true
        },
        fill: {
            type: Boolean,
            default: true
        },
        undo: {
            type: Boolean,
            default: true
        },
        redo: {
            type: Boolean,
            default: true
        },
        clear: {
            type: Boolean,
            default: true
        },
        selection: {
            type: Boolean,
            default: true
        },
        allSelection: {
            type: Boolean,
            default: true
        },
        rowSelection: {
            type: Boolean,
            default: true
        },
        columnSelection: {
            type: Boolean,
            default: true
        },
        autoScroll: {
            type: Boolean,
            default: true
        },
        scrollSpeed: {
            type: Number,
            default: 10,
            validator: value => value > 0
        },
        getCellTextMethod: {
            type: Function
        },
        getCellValueMethod: {
            type: Function
        },
        setCellValueMethod: {
            type: Function
        },
        setClearValueMethod: {
            type: Function
        },
        maxUndoSteps: {
            type: Number,
            default: 50,
            validator: value => value > 0
        },
        textMappingConfig: {
            type: Object
        },
        customMapping: {
            type: Function
        }
    },
    data() {
        return {
            selectedCells: [],
            copiedCells: [],
            extendedCells: [],
            isCutMode: false,
            dragState: {
                type: null,
                startClickInfo: null,
                startCell: null,
                endCell: null,
                headerStartColumnIndex: null,
                fillEndCell: null,
                fillDirection: null
            },
            overlayManager: null,
            cellObserver: null,
            globalEventsAdded: false,
            mouseMoveAnimationId: null,
            autoScrollState: {
                isScrolling: false,
                scrollSpeed: this.scrollSpeed,
                currentScrollDirection: null
            },
            undoRedoManager: null,
            lastCellInfo: null
        };
    },
    mounted() {
        this.initEvents();
        this.initOverlayManager();
        this.initUndoRedoManager();
    },
    beforeDestroy() {
        this.cleanup();
    },
    computed: {
        areaSelection() {
            return {
                copy: this.copy,
                paste: this.paste,
                cut: this.cut,
                fill: this.fill,
                undo: this.undo,
                redo: this.redo,
                clear: this.clear,
                selection: this.selection,
                allSelection: this.allSelection,
                rowSelection: this.rowSelection,
                columnSelection: this.columnSelection,
                autoScroll: this.autoScroll
            };
        }
    },
    methods: {
        getTableElement() {
            return this.$el;
        },
        tableWrapper() {
            const tableEl = this.getTableElement();
            return tableEl?.querySelector(".el-table__body-wrapper") || tableEl;
        },
        cleanup() {
            this.removeAllEvents();
            this.destroyCellObserver();
            if (this.overlayManager) {
                this.overlayManager.destroy();
                this.overlayManager = null;
            }
        },
        startAutoScroll(scrollDirection) {
            if (!this.areaSelection.autoScroll) return;
            if (this.autoScrollState.isScrolling) {
                this.autoScrollState.currentScrollDirection = scrollDirection;
                return;
            }
            const tableWrapper = this.tableWrapper();
            if (!tableWrapper) return;
            const canScrollHorizontally = !tableWrapper.classList.contains("is-scrolling-none") && tableWrapper.scrollWidth > tableWrapper.clientWidth + 10;
            const canScrollVertically = tableWrapper.scrollHeight > tableWrapper.clientHeight + 10;
            if (!canScrollHorizontally && !canScrollVertically) return;
            this.autoScrollState.isScrolling = true;
            this.autoScrollState.currentScrollDirection = scrollDirection;
            const scrollThreshold = 5;
            const {scrollSpeed: scrollSpeed} = this.autoScrollState;
            const scrollAnimation = () => {
                if (!this.autoScrollState.isScrolling) return;
                const currentDirection = this.autoScrollState.currentScrollDirection;
                let scrolled = false;
                if (currentDirection.up && tableWrapper.scrollTop > scrollThreshold) {
                    tableWrapper.scrollTop = Math.max(0, tableWrapper.scrollTop - scrollSpeed);
                    scrolled = true;
                }
                if (currentDirection.down && tableWrapper.scrollTop < tableWrapper.scrollHeight - tableWrapper.clientHeight - scrollThreshold) {
                    tableWrapper.scrollTop = Math.min(tableWrapper.scrollHeight - tableWrapper.clientHeight, tableWrapper.scrollTop + scrollSpeed);
                    scrolled = true;
                }
                if (currentDirection.left && tableWrapper.scrollLeft > scrollThreshold) {
                    tableWrapper.scrollLeft = Math.max(0, tableWrapper.scrollLeft - scrollSpeed);
                    scrolled = true;
                }
                if (currentDirection.right && tableWrapper.scrollLeft < tableWrapper.scrollWidth - tableWrapper.clientWidth - scrollThreshold) {
                    tableWrapper.scrollLeft = Math.min(tableWrapper.scrollWidth - tableWrapper.clientWidth, tableWrapper.scrollLeft + scrollSpeed);
                    scrolled = true;
                }
                if (this.autoScrollState.isScrolling && scrolled) {
                    requestAnimationFrame(scrollAnimation);
                } else {
                    this.stopAutoScroll();
                }
            };
            requestAnimationFrame(scrollAnimation);
        },
        stopAutoScroll() {
            this.autoScrollState.isScrolling = false;
            this.autoScrollState.currentScrollDirection = null;
            this.updateOverlays();
        },
        createSelectAllCorner() {
            if (!this.areaSelection.allSelection) return;
            const corner = document.createElement("div");
            corner.className = "table-select-all-corner";
            corner.title = "全选/取消全选";
            const container = this.getTableElement().querySelector(".el-table");
            if (container) {
                container.appendChild(corner);
                corner.addEventListener("click", event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const tableEl = this.getTableElement();
                    if (!tableEl) return;
                    const columnCount = getColumnCount(this.getTableElement());
                    const rowCount = Math.max(this.rowCount, 1);
                    if (rowCount > 0 && columnCount > 0) {
                        this.selectCells({
                            minRow: 0,
                            maxRow: rowCount - 1,
                            minCol: 0,
                            maxCol: columnCount - 1
                        });
                    }
                });
            }
        },
        initOverlayManager() {
            this.$nextTick(() => {
                this.overlayManager = new OverlayManager({
                    tableEl: this.getTableElement(),
                    initCallback: () => {
                        this.createSelectAllCorner();
                    }
                });
                this.cellObserver = new CellObserver({
                    tableEl: this.getTableElement(),
                    updated: () => {
                        this.updateOverlays();
                    }
                });
            });
        },
        updateOverlays() {
            if (!this.overlayManager) return;
            this.$nextTick(() => {
                this.overlayManager.updateOverlayForType("selection", this.selectedCells);
                this.overlayManager.updateOverlayForType("copyDash", this.copiedCells);
                this.overlayManager.updateOverlayForType("extended", this.extendedCells);
            });
        },
        removeAllEvents() {
            this.removeEvents();
            this.removeTempGlobalEvents();
        },
        addTempGlobalEvents() {
            if (this.globalEventsAdded) return;
            document.addEventListener("mousemove", this.handleGlobalMouseMove);
            document.addEventListener("mouseup", this.handleGlobalMouseUp);
            this.globalEventsAdded = true;
        },
        removeTempGlobalEvents() {
            if (!this.globalEventsAdded) return;
            document.removeEventListener("mousemove", this.handleGlobalMouseMove);
            document.removeEventListener("mouseup", this.handleGlobalMouseUp);
            this.globalEventsAdded = false;
        },
        initEvents() {
            this.getTableElement().addEventListener("keydown", this.handleKeyDown);
            document.addEventListener("mousedown", this.handleGlobalMouseDown);
        },
        removeEvents() {
            this.getTableElement().removeEventListener("keydown", this.handleKeyDown);
            document.removeEventListener("mousedown", this.handleGlobalMouseDown);
        },
        handleKeyDown(event) {
            const tableEl = this.getTableElement();
            if (!tableEl) return;
            if (event.ctrlKey && event.key === "a") {
                if (!this.areaSelection.allSelection) {
                    console.warn("全选操作被禁用");
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                const columnCount = getColumnCount(this.getTableElement());
                const rowCount = Math.max(this.rowCount, 1);
                if (rowCount > 0 && columnCount > 0) {
                    this.selectCells({
                        minRow: 0,
                        maxRow: rowCount - 1,
                        minCol: 0,
                        maxCol: columnCount - 1
                    });
                }
                return;
            }
            if (event.ctrlKey && event.shiftKey && event.key === "C") {
                if (!this.areaSelection.copy) {
                    console.warn("复制操作被禁用");
                    return;
                }
                this.copyCellsValues(false, true);
                return;
            }
            if (event.ctrlKey && event.key === "c") {
                if (!this.areaSelection.copy) {
                    console.warn("复制操作被禁用");
                    return;
                }
                this.copyCellsValues();
            }
            if (event.ctrlKey && event.key === "x") {
                if (!this.areaSelection.cut) {
                    console.warn("剪切操作被禁用");
                    return;
                }
                this.copyCellsValues(true);
            }
            if (event.ctrlKey && event.key === "v") {
                if (!this.areaSelection.paste) {
                    console.warn("粘贴操作被禁用");
                    return;
                }
                this.pasteCellsValues();
            }
            if (event.ctrlKey && event.shiftKey && event.key === "Z" || event.ctrlKey && event.key === "y") {
                if (!this.areaSelection.redo) {
                    console.warn("重做操作被禁用");
                    return;
                }
                this.executeRedo();
                return;
            }
            if (event.ctrlKey && event.key === "z") {
                if (!this.areaSelection.undo) {
                    console.warn("撤销操作被禁用");
                    return;
                }
                this.executeUndo();
            }
            if (event.key === "Delete" || event.key === "Backspace") {
                if (!this.areaSelection.clear) {
                    console.warn("清空操作被禁用");
                    return;
                }
                event.preventDefault();
                this.clearCells(this.selectedCells, "clear");
                return;
            }
            if (event.key === "Escape") {
                this.clearCellSelection();
            }
        },
        detectClickType(event, tableEl) {
            const target = event.target;
            if (target.classList.contains("fill-handle")) {
                return {
                    type: "fillHandle",
                    target: target
                };
            }
            if (target.closest(".el-table__header")) {
                const cellInfo = getBoundaryCellFromMousePosition(event, tableEl);
                return {
                    type: "header",
                    target: target,
                    cellInfo: cellInfo
                };
            }
            if (target.closest(".el-table__body")) {
                const cellInfo = getBoundaryCellFromMousePosition(event, tableEl);
                if (cellInfo) {
                    return {
                        type: "cell",
                        target: target,
                        cellInfo: cellInfo
                    };
                }
            }
            return {
                type: "unknown",
                target: target
            };
        },
        handleGlobalMouseDown(event) {
            const tableEl = this.getTableElement();
            if (!tableEl) {
                return;
            }
            if (!isInnerCell(event, tableEl)) {
                this.clearCellSelection();
                this.copiedCells = [];
                return;
            }
            if (event.button !== 0) return;
            const cursor = window.getComputedStyle(event.target).cursor;
            if (cursor === "col-resize" || cursor === "row-resize" || cursor === "pointer") {
                return;
            }
            const clickInfo = this.detectClickType(event, tableEl);
            this.dragState.startClickInfo = clickInfo;
            this.handleUnifiedMouseDown(event, clickInfo);
            tableEl.style.userSelect = "none";
        },
        handleUnifiedMouseDown(event, clickInfo) {
            const {type: type, cellInfo: cellInfo} = clickInfo;
            this.addTempGlobalEvents();
            switch (type) {
              case "fillHandle":
                this.handleFillHandleMouseDown(event);
                break;

              case "header":
                if (!this.areaSelection.selection) {
                    console.warn("区域选择操作被禁用");
                    return;
                }
                this.clearCellSelection();
                this.handleHeaderMouseDown(event, cellInfo);
                break;

              case "cell":
                if (!this.areaSelection.selection) {
                    console.warn("区域选择操作被禁用");
                    return;
                }
                this.clearCellSelection();
                this.handleCellMouseDown(event, cellInfo);
                break;
            }
        },
        handleHeaderMouseDown(event, cellInfo) {
            if (!this.areaSelection.columnSelection) {
                console.warn("列选择操作被禁用");
                return;
            }
            this.dragState.type = "headerSelect";
            this.dragState.headerStartColumnIndex = cellInfo.columnIndex;
            const rowCount = Math.max(this.rowCount, 1);
            this.selectCells({
                minRow: 0,
                maxRow: rowCount - 1,
                minCol: cellInfo.columnIndex,
                maxCol: cellInfo.columnIndex
            });
        },
        handleCellMouseDown(event, cellInfo) {
            if (!cellInfo) return;
            this.dragState.type = "select";
            this.dragState.startCell = cellInfo;
            const columnConfig = this.getColumnByIndex(cellInfo.columnIndex);
            if (columnConfig && columnConfig.type === "index" && this.areaSelection.rowSelection) {
                let rowspan = 1;
                if (cellInfo.element) {
                    const rowspanAttr = cellInfo.element.getAttribute("rowspan");
                    if (rowspanAttr) {
                        rowspan = parseInt(rowspanAttr, 10) || 1;
                    }
                }
                const columnCount = getColumnCount(this.getTableElement());
                if (columnCount > 0) {
                    this.selectCells({
                        minRow: cellInfo.rowIndex,
                        maxRow: cellInfo.rowIndex + rowspan - 1,
                        minCol: 0,
                        maxCol: columnCount - 1
                    });
                }
            } else {
                this.selectCells({
                    minRow: cellInfo.rowIndex,
                    maxRow: cellInfo.rowIndex,
                    minCol: cellInfo.columnIndex,
                    maxCol: cellInfo.columnIndex
                });
            }
        },
        handleGlobalMouseMove(event) {
            const {type: type} = this.dragState;
            if (!type) return;
            const scrollDirection = detectScrollDirection(event, this.tableWrapper());
            if (this.dragState.startClickInfo.type === "header") {
                if (scrollDirection && (scrollDirection.left || scrollDirection.right)) {
                    if (scrollDirection) {
                        this.startAutoScroll(scrollDirection);
                    } else {
                        this.stopAutoScroll();
                    }
                }
            } else {
                if (scrollDirection) {
                    this.startAutoScroll(scrollDirection);
                } else {
                    this.stopAutoScroll();
                }
            }
            if (type === "fill") {
                this.handleFillDragMove(event);
            } else if (type === "headerSelect") {
                this.handleHeaderDragMove(event);
            } else if (type === "select") {
                this.handleCellDragMove(event);
            }
        },
        handleHeaderDragMove(event) {
            const columnIndex = getBoundaryCellFromMousePosition(event, this.getTableElement())?.columnIndex;
            if (columnIndex === null || columnIndex === undefined) return;
            const {headerStartColumnIndex: headerStartColumnIndex} = this.dragState;
            const minCol = Math.min(headerStartColumnIndex, columnIndex);
            const maxCol = Math.max(headerStartColumnIndex, columnIndex);
            const rowCount = Math.max(this.rowCount, 1);
            this.selectCells({
                minRow: 0,
                maxRow: rowCount - 1,
                minCol: minCol,
                maxCol: maxCol
            });
        },
        handleCellDragMove(event) {
            if (this.mouseMoveAnimationId) {
                cancelAnimationFrame(this.mouseMoveAnimationId);
            }
            this.mouseMoveAnimationId = requestAnimationFrame(() => {
                const cellInfo = getBoundaryCellFromMousePosition(event, this.getTableElement());
                if (this.lastCellInfo && cellInfo && this.lastCellInfo.rowIndex === cellInfo.rowIndex && this.lastCellInfo.columnIndex === cellInfo.columnIndex) {
                    return;
                }
                this.lastCellInfo = cellInfo;
                if (cellInfo) {
                    const {startCell: startCell} = this.dragState;
                    this.dragState.endCell = cellInfo;
                    const startColumnConfig = this.getColumnByIndex(startCell.columnIndex);
                    if (startColumnConfig.type === "index") {
                        const startRowIndex = Math.min(startCell.rowIndex, cellInfo.rowIndex);
                        const endRowIndex = Math.max(startCell.rowIndex, cellInfo.rowIndex);
                        let startRowspan = 1;
                        if (this.dragState.startCell.element) {
                            const rowspanAttr = this.dragState.startCell.element.getAttribute("rowspan");
                            if (rowspanAttr) {
                                startRowspan = parseInt(rowspanAttr, 10) || 1;
                            }
                        }
                        let endRowspan = 1;
                        if (cellInfo.element) {
                            const rowspanAttr = cellInfo.element.getAttribute("rowspan");
                            if (rowspanAttr) {
                                endRowspan = parseInt(rowspanAttr, 10) || 1;
                            }
                        }
                        const actualEndRowIndex = Math.max(startRowIndex + startRowspan - 1, endRowIndex + endRowspan - 1);
                        const columnCount = getColumnCount(this.getTableElement());
                        if (columnCount > 0) {
                            this.selectCells({
                                minRow: startRowIndex,
                                maxRow: actualEndRowIndex,
                                minCol: 0,
                                maxCol: columnCount - 1
                            });
                        }
                    } else {
                        this.selectCells({
                            minRow: Math.min(startCell.rowIndex, cellInfo.rowIndex),
                            maxRow: Math.max(startCell.rowIndex, cellInfo.rowIndex),
                            minCol: Math.min(startCell.columnIndex, cellInfo.columnIndex),
                            maxCol: Math.max(startCell.columnIndex, cellInfo.columnIndex)
                        });
                    }
                }
                this.mouseMoveAnimationId = null;
            });
        },
        handleGlobalMouseUp(event) {
            const {type: type} = this.dragState;
            if (!type) return;
            this.dragState.type = null;
            this.stopAutoScroll();
            this.updateOverlays();
            if (type === "fill") {
                this.handleFillDragEnd(event);
            } else if (type === "headerSelect") {
                this.dragState.headerStartColumnIndex = null;
                this.removeTempGlobalEvents();
            } else if (type === "select") {
                this.dragState.endCell = null;
                this.lastCellInfo = null;
                this.removeTempGlobalEvents();
            }
        },
        selectCells({minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol}) {
            const tableEl = this.getTableElement();
            if (!tableEl) return;
            this.clearCellSelection();
            let newSelectedCells = [ ...this.selectedCells ];
            const addCellToSelection = (row, col) => {
                const cellInfo = createCellInfo(row, col);
                const exists = newSelectedCells.some(cell => cell.rowIndex === row && cell.columnIndex === col);
                if (!exists) {
                    newSelectedCells.push(cellInfo);
                }
            };
            for (let row = minRow; row <= maxRow; row++) {
                for (let col = minCol; col <= maxCol; col++) {
                    const cellElement = getCellElement(tableEl, row, col);
                    if (cellElement) {
                        addCellToSelection(row, col);
                    }
                }
            }
            this.selectedCells = newSelectedCells;
            this.updateOverlays();
            this.cellObserver.startObserving(this.selectedCells, "selected");
            this.$emit("excel-select", {
                selectedCells: this.selectedCells,
                bounds: {
                    minRow: minRow,
                    maxRow: maxRow,
                    minCol: minCol,
                    maxCol: maxCol
                }
            });
        },
        clearCellSelection() {
            this.selectedCells = [];
            this.updateOverlays();
            this.cellObserver.stopObserving();
        },
        destroyCellObserver() {
            if (this.cellObserver) {
                this.cellObserver.stopObserving();
                this.cellObserver = null;
            }
        },
        async copyCellsValues(isCut = false, includeHeaders = false) {
            try {
                if (!this.selectedCells.length) return;
                this.isCutMode = isCut;
                this.copiedCells = [ ...this.selectedCells ];
                const cellsData = this.copiedCells.sort((a, b) => {
                    if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
                    return a.columnIndex - b.columnIndex;
                });
                const tableEl = this.getTableElement();
                const textRows = {};
                const valueTextRows = {};
                cellsData.forEach(cell => {
                    const {rowIndex: rowIndex, columnIndex: columnIndex} = cell;
                    if (!textRows[rowIndex]) textRows[rowIndex] = {};
                    if (!valueTextRows[rowIndex]) valueTextRows[rowIndex] = {};
                    const element = getCellElement(tableEl, rowIndex, columnIndex);
                    const cellText = getCellText(element) || "";
                    if (this.getCellTextMethod) {
                        try {
                            const row = this.getRowDataByIndex(rowIndex);
                            const column = this.getColumnByIndex(columnIndex);
                            textRows[rowIndex][columnIndex] = this.getCellTextMethod({
                                row: row,
                                column: column,
                                rowIndex: rowIndex,
                                columnIndex: columnIndex,
                                element: element,
                                cellText: cellText
                            });
                        } catch (error) {
                            console.error(cell, `自定义获取单元格文本出错:`, error);
                            textRows[rowIndex][columnIndex] = cellText;
                        }
                    } else {
                        textRows[rowIndex][columnIndex] = cellText;
                    }
                    textRows[rowIndex][columnIndex] = cellText;
                    const cellValue = this.getCellValue(rowIndex, columnIndex, "copy") || cellText;
                    let valueText = "";
                    if (Array.isArray(cellValue) || typeof cellValue === "object" && cellValue !== null) {
                        valueText = JSON.stringify(cellValue);
                    } else {
                        valueText = String(cellValue);
                    }
                    valueTextRows[rowIndex][columnIndex] = valueText;
                });
                let {textData: textData} = convertRowsToTableData(textRows);
                const {textData: valueTextData} = convertRowsToTableData(valueTextRows);
                if (includeHeaders) {
                    const columnIndices = [ ...new Set(cellsData.map(cell => cell.columnIndex)) ].sort((a, b) => a - b);
                    const headerTexts = columnIndices.map(columnIndex => getHeaderText(tableEl, columnIndex));
                    const headerLine = headerTexts.join("\t");
                    textData = headerLine + "\n" + textData;
                }
                try {
                    const jsonData = {
                        type: "super-crud-data",
                        data: {
                            valueTextRows: valueTextRows,
                            textData: valueTextData,
                            originalTextData: textData,
                            timestamp: Date.now()
                        }
                    };
                    const clipboardItem = new ClipboardItem({
                        "text/plain": new Blob([ textData ], {
                            type: "text/plain"
                        }),
                        [applicationType]: new Blob([ JSON.stringify(jsonData) ], {
                            type: applicationType
                        })
                    });
                    await navigator.clipboard.write([ clipboardItem ]);
                } catch (error) {
                    console.error("使用多格式剪贴板失败，降级到文本模式:", error);
                    await navigator.clipboard.writeText(textData);
                }
                this.updateOverlays();
                this.cellObserver.startObserving(this.copiedCells, "copied");
                this.$emit("excel-copy", {
                    valueRows: valueTextRows,
                    textRows: valueTextData,
                    copiedCells: this.copiedCells,
                    isCut: isCut,
                    includeHeaders: includeHeaders
                });
            } catch (error) {
                console.error("复制失败:", error);
            }
        },
        async pasteCellsValues() {
            try {
                if (!this.selectedCells.length) return;
                const {textData: textData, isInternal: isInternal} = await readClipboardData(applicationType);
                const {affectedCells: affectedCells, pasteBounds: pasteBounds} = this.applyPasteData(textData, this.selectedCells, isInternal);
                if (affectedCells && affectedCells.length > 0) {
                    this.recordUndoHistory("paste", affectedCells);
                }
                if (this.isCutMode) {
                    await this.clearCells(this.copiedCells, "cut");
                }
                this.$emit("excel-paste", {
                    pastedCells: affectedCells,
                    isCutMode: this.isCutMode
                });
                this.copiedCells = [];
                this.selectCells(pasteBounds);
                this.updateOverlays();
            } catch (error) {
                console.error("粘贴失败:", error);
            }
        },
        async clearCells(cells, type) {
            try {
                const affectedCells = [];
                for (const cell of cells) {
                    const {rowIndex: rowIndex, columnIndex: columnIndex} = cell;
                    const {oldValue: oldValue, clearValue: clearValue} = this.setClearValue(rowIndex, columnIndex);
                    affectedCells.push({
                        rowIndex: rowIndex,
                        columnIndex: columnIndex,
                        oldValue: oldValue,
                        newValue: clearValue
                    });
                }
                if (affectedCells.length > 0) {
                    this.recordUndoHistory(type, affectedCells);
                }
                this.$emit("excel-clear", {
                    clearedCells: affectedCells
                });
            } catch (error) {
                console.error("清空剪切单元格失败:", error);
            }
        },
        handleFillHandleMouseDown(event) {
            if (!this.areaSelection.fill) {
                console.warn("填充操作被禁用");
                return;
            }
            const dragState = this.dragState;
            Object.assign(dragState, {
                type: "fill",
                fillDirection: null
            });
            document.body.style.cursor = "crosshair";
        },
        handleFillDragMove(event) {
            const {fillDirection: fillDirection} = this.dragState;
            const cellInfo = getBoundaryCellFromMousePosition(event, this.getTableElement());
            if (cellInfo) {
                const originalSelectionBounds = getCellsBounds(this.selectedCells);
                if (!originalSelectionBounds) return;
                const {rowIndex: currentRow, columnIndex: currentCol} = cellInfo;
                const {minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol} = originalSelectionBounds;
                if (fillDirection === null) {
                    const isOutsideRight = currentCol > maxCol;
                    const isOutsideLeft = currentCol < minCol;
                    const isOutsideBottom = currentRow > maxRow;
                    const isOutsideTop = currentRow < minRow;
                    let horizontalDistance = 0;
                    let verticalDistance = 0;
                    if (isOutsideRight) {
                        horizontalDistance = currentCol - maxCol;
                    } else if (isOutsideLeft) {
                        horizontalDistance = minCol - currentCol;
                    }
                    if (isOutsideBottom) {
                        verticalDistance = currentRow - maxRow;
                    } else if (isOutsideTop) {
                        verticalDistance = minRow - currentRow;
                    }
                    if (verticalDistance > horizontalDistance && verticalDistance > 0) {
                        this.dragState.fillDirection = "vertical";
                    } else if (horizontalDistance > verticalDistance && horizontalDistance > 0) {
                        this.dragState.fillDirection = "horizontal";
                    } else {
                        return;
                    }
                }
                let constrainedCellInfo = {
                    ...cellInfo
                };
                const currentFillDirection = this.dragState.fillDirection;
                if (currentFillDirection === "horizontal") {
                    if (currentCol > maxCol) {
                        constrainedCellInfo.rowIndex = maxRow;
                    } else if (currentCol < minCol) {
                        constrainedCellInfo.rowIndex = minRow;
                    }
                } else if (currentFillDirection === "vertical") {
                    if (currentRow > maxRow) {
                        constrainedCellInfo.columnIndex = maxCol;
                    } else if (currentRow < minRow) {
                        constrainedCellInfo.columnIndex = minCol;
                    }
                }
                this.dragState.fillEndCell = constrainedCellInfo;
                const {rowIndex: dragRow, columnIndex: dragCol} = constrainedCellInfo;
                const extendedBounds = {
                    minRow: Math.min(minRow, dragRow),
                    maxRow: Math.max(maxRow, dragRow),
                    minCol: Math.min(minCol, dragCol),
                    maxCol: Math.max(maxCol, dragCol)
                };
                const extendedCells = [];
                for (let row = extendedBounds.minRow; row <= extendedBounds.maxRow; row++) {
                    for (let col = extendedBounds.minCol; col <= extendedBounds.maxCol; col++) {
                        extendedCells.push(createCellInfo(row, col));
                    }
                }
                this.extendedCells = extendedCells;
            }
            this.updateOverlays();
        },
        handleFillDragEnd(event) {
            const {fillEndCell: fillEndCell, fillDirection: fillDirection} = this.dragState;
            this.extendedCells = [];
            const originalBounds = getCellsBounds(this.selectedCells);
            let fillCells = [];
            if (fillEndCell && originalBounds) {
                const fillStartRow = Math.min(originalBounds.minRow, fillEndCell.rowIndex);
                const fillEndRow = Math.max(originalBounds.maxRow, fillEndCell.rowIndex);
                const fillStartCol = Math.min(originalBounds.minCol, fillEndCell.columnIndex);
                const fillEndCol = Math.max(originalBounds.maxCol, fillEndCell.columnIndex);
                const tableEl = this.getTableElement();
                for (let row = fillStartRow; row <= fillEndRow; row++) {
                    for (let col = fillStartCol; col <= fillEndCol; col++) {
                        const cellElement = getCellElement(tableEl, row, col);
                        if (cellElement) {
                            fillCells.push({
                                rowIndex: row,
                                columnIndex: col,
                                element: cellElement
                            });
                        }
                    }
                }
                const disableSmartFill = event.ctrlKey || event.metaKey;
                const {affectedCells: affectedCells, fillBounds: fillBounds} = this.performFillOperation(originalBounds, fillCells, fillDirection, disableSmartFill);
                this.selectCells(fillBounds);
            }
            this.removeTempGlobalEvents();
            document.body.style.cursor = "";
            Object.assign(this.dragState, {
                type: null,
                fillEndCell: null,
                fillDirection: null
            });
            this.updateOverlays();
            this.$emit("excel-fill", {
                fillCells: affectedCells
            });
        },
        initUndoRedoManager() {
            this.undoRedoManager = new UndoRedoManager({
                maxSize: this.maxUndoSteps
            });
        },
        recordUndoHistory(operationType, affectedCells) {
            this.undoRedoManager.recordHistory(operationType, affectedCells);
        },
        applyCellValues(affectedCells, valueType = "newValue") {
            for (const cellData of affectedCells) {
                const {rowIndex: rowIndex, columnIndex: columnIndex} = cellData;
                const value = cellData[valueType];
                this.setCellValue(rowIndex, columnIndex, value, "undo");
            }
            if (affectedCells.length > 0) {
                this.selectCells(getCellsBounds(affectedCells));
            }
        },
        async executeUndo() {
            const {affectedCells: affectedCells} = this.undoRedoManager.executeUndo();
            if (!affectedCells) return;
            this.applyCellValues(affectedCells, "oldValue");
            this.$emit("excel-undo", {
                affectedCells: affectedCells
            });
        },
        async executeRedo() {
            const {affectedCells: affectedCells} = this.undoRedoManager.executeRedo();
            if (!affectedCells) return;
            this.applyCellValues(affectedCells, "newValue");
            this.$emit("excel-redo", {
                affectedCells: affectedCells
            });
        }
    },
    render(h) {
        return h("div", {
            class: {
                "el-table-excel-wrapper": true
            },
            attrs: {
                tabindex: "0"
            }
        }, this.$slots.default);
    }
};

function normalizeComponent(template, style, script, scopeId, isFunctionalTemplate, moduleIdentifier, shadowMode, createInjector, createInjectorSSR, createInjectorShadow) {
    const options = typeof script === "function" ? script.options : script;
    if (template && template.render) {
        options.render = template.render;
        options.staticRenderFns = template.staticRenderFns;
        options._compiled = true;
    }
    let hook;
    if (style) {
        hook = function(context) {
            style.call(this, createInjector(context));
        };
    }
    if (hook) {
        if (options.functional) {
            const originalRender = options.render;
            options.render = function renderWithStyleInjection(h, context) {
                hook.call(context);
                return originalRender(h, context);
            };
        } else {
            const existing = options.beforeCreate;
            options.beforeCreate = existing ? [].concat(existing, hook) : [ hook ];
        }
    }
    return script;
}

const isOldIE = typeof navigator !== "undefined" && /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());

function createInjector(context) {
    return (id, style) => addStyle(id, style);
}

let HEAD;

const styles = {};

function addStyle(id, css) {
    const group = isOldIE ? css.media || "default" : id;
    const style = styles[group] || (styles[group] = {
        ids: new Set,
        styles: []
    });
    if (!style.ids.has(id)) {
        style.ids.add(id);
        let code = css.source;
        if (css.map) {
            code += "\n/*# sourceURL=" + css.map.sources[0] + " */";
            code += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(css.map)))) + " */";
        }
        if (!style.element) {
            style.element = document.createElement("style");
            style.element.type = "text/css";
            if (css.media) style.element.setAttribute("media", css.media);
            if (HEAD === undefined) {
                HEAD = document.head || document.getElementsByTagName("head")[0];
            }
            HEAD.appendChild(style.element);
        }
        if ("styleSheet" in style.element) {
            style.styles.push(code);
            style.element.styleSheet.cssText = style.styles.filter(Boolean).join("\n");
        } else {
            const index = style.ids.size - 1;
            const textNode = document.createTextNode(code);
            const nodes = style.element.childNodes;
            if (nodes[index]) style.element.removeChild(nodes[index]);
            if (nodes.length) style.element.insertBefore(textNode, nodes[index]); else style.element.appendChild(textNode);
        }
    }
}

const __vue_script__ = script;

const __vue_inject_styles__ = function(inject) {
    if (!inject) return;
    inject("data-v-276ffb32_0", {
        source: "\n.el-table-excel-wrapper {\r\n  outline: none;\n}\r\n/* 选中区域遮罩层样式 */\n.el-table .cell-selection-overlay {\r\n  position: absolute;\r\n  display: none;\r\n  pointer-events: none;\r\n  box-sizing: border-box;\r\n  z-index: 3;\r\n  background-color: rgba(64, 158, 255, 0.1);\r\n  border: 1px solid #409eff;\r\n  border-radius: 2px;\n}\r\n\r\n/* 填充小方块 */\n.el-table .cell-selection-overlay .fill-handle {\r\n  pointer-events: auto;\r\n  position: absolute;\r\n  right: 0;\r\n  bottom: 0;\r\n  width: 4px;\r\n  height: 4px;\r\n  background-color: #409eff;\r\n  cursor: crosshair;\r\n  z-index: 3;\r\n  box-sizing: border-box;\r\n  border-radius: 1px;\n}\n.el-table .cell-selection-overlay .fill-handle:hover {\r\n  background-color: #40a9ff;\r\n  transform: scale(1.2);\r\n  box-shadow: 0 0 4px rgba(64, 158, 255, 0.5);\n}\n.el-table .cell-selection-overlay .fill-handle:active {\r\n  background-color: #096dd9;\r\n  transform: scale(1.1);\n}\r\n\r\n/* 复制虚线框样式 */\n.el-table .copy-dash-overlay {\r\n  position: absolute;\r\n  display: none;\r\n  pointer-events: none;\r\n  box-sizing: border-box;\r\n  z-index: 3;\r\n  background: transparent;\r\n  border: 2px dashed #409eff;\r\n  border-radius: 2px;\n}\r\n\r\n/* 扩展选中区域样式 */\n.el-table .extended-selection-overlay {\r\n  position: absolute;\r\n  display: none;\r\n  pointer-events: none;\r\n  box-sizing: border-box;\r\n  z-index: 3;\r\n  border: 2px dashed #909399;\r\n  border-radius: 2px;\n}\r\n\r\n/* 左上角全选角标样式 - 三角形设计 */\n.el-table .table-select-all-corner {\r\n  position: absolute;\r\n  top: 0;\r\n  left: 0;\r\n  width: 0;\r\n  height: 0;\r\n  border-style: solid;\r\n  border-width: 10px 10px 0 0;\r\n  border-color: #909399 transparent transparent transparent;\r\n  cursor: pointer;\r\n  z-index: 1002;\r\n  box-sizing: border-box;\n}\n.el-table .table-select-all-corner:active {\r\n  border-color: #409eff transparent transparent transparent;\n}\r\n",
        map: undefined,
        media: undefined
    });
};

const __vue_scope_id__ = undefined;

const __vue_module_identifier__ = undefined;

const __vue_is_functional_template__ = undefined;

const __vue_component__ = normalizeComponent({}, __vue_inject_styles__, __vue_script__, __vue_scope_id__, __vue_is_functional_template__, __vue_module_identifier__, false, createInjector);

export { __vue_component__ as default };
