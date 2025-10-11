<script>
import {
  createCellInfo,
  getCellText,
  getCellElement,
  getBoundaryCellFromMousePosition,
  getHeaderText,
  detectScrollDirection,
  getCellsBounds,
  convertRowsToTableData,
  readClipboardData,
  getColumnCount,
  isInnerCell,
  calculateDynamicSpeed,
} from "./utils.js";

import { UndoRedoManager } from "./undoRedoManager.js";
import { OverlayManager } from "./overlayManager.js";
import { CellObserver } from "./cellObserver.js";
import dataProcessor from "./dataProcessor.js";

const applicationType = "web application/super-crud-data";

export default {
  mixins: [dataProcessor],

  props: {
    // 功能开关配置
    copy: {
      type: Boolean,
      default: true,
    },
    paste: {
      type: Boolean,
      default: true,
    },
    cut: {
      type: Boolean,
      default: true,
    },
    fill: {
      type: Boolean,
      default: true,
    },
    undo: {
      type: Boolean,
      default: true,
    },
    redo: {
      type: Boolean,
      default: true,
    },
    clear: {
      type: Boolean,
      default: true,
    },
    selection: {
      type: Boolean,
      default: true,
    },
    allSelection: {
      type: Boolean,
      default: true,
    },
    rowSelection: {
      type: Boolean,
      default: true,
    },
    columnSelection: {
      type: Boolean,
      default: true,
    },
    autoScroll: {
      type: Boolean,
      default: true,
    },
    scrollSpeed: {
      type: Number,
      default: 10,
      validator: (value) => value > 0,
    },
    // 自定义获取单元格文本方法
    getCellTextMethod: {
      type: Function,
    },
    // 自定义获取单元格值方法
    getCellValueMethod: {
      type: Function,
    },
    // 自定义设置单元格值方法
    setCellValueMethod: {
      type: Function,
    },
    // 自定义清空值方法
    setClearValueMethod: {
      type: Function,
    },
    // 高级配置
    maxUndoSteps: {
      type: Number,
      default: 50,
      validator: (value) => value > 0,
    },
    // 外部文本值映射配置
    textMappingConfig: {
      type: Object,
    },
    // 自定义外部文本映射方法
    customMapping: {
      type: Function,
    },
    // 配置自定义填充列表
    fillCustomLists: {
      type: Array,
      default: () => [],
    },
  },

  data() {
    return {
      // 单元格选中状态
      selectedCells: [], // 存储选中的单元格 "rowIndex-columnIndex"
      copiedCells: [], // 已复制的单元格索引信息
      extendedCells: [], // 扩展选中的单元格
      isCutMode: false, // 是否为剪切模式

      // 拖拽状态
      dragState: {
        type: null, // 'select','headerSelect', 'fill'
        startClickInfo: null,
        startCell: null,
        endCell: null,
        headerStartColumnIndex: null,
        fillEndCell: null,
        fillDirection: null, // 'horizontal', 'vertical', null
      },

      // 遮罩层管理器
      overlayManager: null,

      // DOM监听
      cellObserver: null,
      globalEventsAdded: false,

      // requestAnimationFrame防抖
      mouseMoveAnimationId: null,

      // 自动滚动状态
      autoScrollState: {
        isScrolling: false,
        scrollSpeed: this.scrollSpeed,
        currentScrollDirection: null,
        animationFrameId: null,
      },

      // 撤销重做管理器
      undoRedoManager: null,

      // 拖拽缓存优化
      lastCellInfo: null,

      // 遮罩层状态缓存
      lastSelectedCells: [],
      lastExtendedCells: [],
      lastCopiedCells: [],
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
        autoScroll: this.autoScroll,
      };
    },
  },

  methods: {
    // ========== 公共方法 ==========

    // 获取表格元素
    getTableElement() {
      return this.$el;
    },
    // 获取表格容器元素
    tableWrapper() {
      const tableEl = this.getTableElement();
      return tableEl?.querySelector(".el-table__body-wrapper") || tableEl;
    },

    // 清理所有资源
    cleanup() {
      this.removeAllEvents();
      this.destroyCellObserver();

      // 清理自动滚动
      this.stopAutoScroll();

      if (this.overlayManager) {
        this.overlayManager.destroy();
        this.overlayManager = null;
      }
    },

    // 比较两个数组是否相等
    arraysEqual(arr1, arr2) {
      if (arr1.length !== arr2.length) return false;
      return arr1.every(
        (item, index) =>
          arr2[index].columnIndex === item.columnIndex &&
          arr2[index].rowIndex === item.rowIndex
      );
    },

    // ========== 自动滚动相关方法 ==========
    // 开始自动滚动
    startAutoScroll(scrollDirection) {
      if (!this.areaSelection.autoScroll) return;
      if (
        this.autoScrollState.isScrolling &&
        this.autoScrollState.animationFrameId
      ) {
        cancelAnimationFrame(this.autoScrollState.animationFrameId);
        this.autoScrollState.animationFrameId = null;
        this.autoScrollState.currentScrollDirection = scrollDirection;
      } else if (this.autoScrollState.isScrolling) {
        this.autoScrollState.currentScrollDirection = scrollDirection;
        return;
      }

      const tableWrapper = this.tableWrapper();
      if (!tableWrapper) return;

      // 检查表格是否可以滚动
      const canScrollHorizontally =
        !tableWrapper.classList.contains("is-scrolling-none") &&
        tableWrapper.scrollWidth > tableWrapper.clientWidth + 10;
      const canScrollVertically =
        tableWrapper.scrollHeight > tableWrapper.clientHeight + 10;

      if (!canScrollHorizontally && !canScrollVertically) return;

      this.autoScrollState.isScrolling = true;
      this.autoScrollState.currentScrollDirection = scrollDirection;

      const scrollThreshold = 5; // 边界阈值，避免精确比较
      const baseScrollSpeed = this.autoScrollState.scrollSpeed;

      const scrollAnimation = () => {
        if (!this.autoScrollState.isScrolling) {
          this.autoScrollState.animationFrameId = null;
          return;
        }

        const currentDirection = this.autoScrollState.currentScrollDirection;
        let scrolled = false;

        // 垂直滚动处理
        if (currentDirection.up && tableWrapper.scrollTop > scrollThreshold) {
          const dynamicSpeed = currentDirection.upDistance
            ? calculateDynamicSpeed(
                currentDirection.upDistance,
                baseScrollSpeed
              )
            : baseScrollSpeed;

          tableWrapper.scrollTop = Math.max(
            0,
            tableWrapper.scrollTop - dynamicSpeed
          );
          scrolled = true;
        }
        if (
          currentDirection.down &&
          tableWrapper.scrollTop <
            tableWrapper.scrollHeight -
              tableWrapper.clientHeight -
              scrollThreshold
        ) {
          const dynamicSpeed = currentDirection.downDistance
            ? calculateDynamicSpeed(
                currentDirection.downDistance,
                baseScrollSpeed
              )
            : baseScrollSpeed;

          tableWrapper.scrollTop = Math.min(
            tableWrapper.scrollHeight - tableWrapper.clientHeight,
            tableWrapper.scrollTop + dynamicSpeed
          );
          scrolled = true;
        }

        // 水平滚动处理
        if (
          currentDirection.left &&
          tableWrapper.scrollLeft > scrollThreshold
        ) {
          const dynamicSpeed = currentDirection.leftDistance
            ? calculateDynamicSpeed(
                currentDirection.leftDistance,
                baseScrollSpeed
              )
            : baseScrollSpeed;
          tableWrapper.scrollLeft = Math.max(
            0,
            tableWrapper.scrollLeft - dynamicSpeed
          );
          scrolled = true;
        }
        if (
          currentDirection.right &&
          tableWrapper.scrollLeft <
            tableWrapper.scrollWidth -
              tableWrapper.clientWidth -
              scrollThreshold
        ) {
          const dynamicSpeed = currentDirection.rightDistance
            ? calculateDynamicSpeed(
                currentDirection.rightDistance,
                baseScrollSpeed
              )
            : baseScrollSpeed;
          tableWrapper.scrollLeft = Math.min(
            tableWrapper.scrollWidth - tableWrapper.clientWidth,
            tableWrapper.scrollLeft + dynamicSpeed
          );
          scrolled = true;
        }

        // 继续滚动或停止
        if (this.autoScrollState.isScrolling && scrolled) {
          this.autoScrollState.animationFrameId =
            requestAnimationFrame(scrollAnimation);
        } else {
          this.stopAutoScroll();
        }
      };

      this.autoScrollState.animationFrameId =
        requestAnimationFrame(scrollAnimation);
    },

    // 停止自动滚动
    stopAutoScroll() {
      // 取消动画帧
      if (this.autoScrollState.animationFrameId) {
        cancelAnimationFrame(this.autoScrollState.animationFrameId);
        this.autoScrollState.animationFrameId = null;
      }

      this.autoScrollState.isScrolling = false;
      this.autoScrollState.currentScrollDirection = null;
    },

    // 创建全选角标
    createSelectAllCorner() {
      if (!this.areaSelection.allSelection) return;
      const corner = document.createElement("div");
      corner.className = "table-select-all-corner";
      corner.title = "全选/取消全选";

      const container = this.getTableElement().querySelector(".el-table");
      if (container) {
        container.appendChild(corner);

        // 添加点击事件
        corner.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const tableEl = this.getTableElement();
          if (!tableEl) return;

          // 全选
          const columnCount = getColumnCount(this.getTableElement());
          const rowCount = Math.max(this.rowCount, 1); // 至少选择1行，即使没有数据
          if (rowCount > 0 && columnCount > 0) {
            this.selectCells({
              minRow: 0,
              maxRow: rowCount - 1,
              minCol: 0,
              maxCol: columnCount - 1,
            });
          }
        });
      }
    },

    // ========== 遮罩层管理 ==========

    // 初始化遮罩层管理器
    initOverlayManager() {
      this.$nextTick(() => {
        this.overlayManager = new OverlayManager({
          tableEl: this.getTableElement(),
          initCallback: () => {
            this.createSelectAllCorner();
          },
        });

        // 初始化顶行监听器
        this.cellObserver = new CellObserver({
          tableEl: this.getTableElement(),
          updated: () => {
            this.updateOverlays(true);
          },
        });
      });
    },
    // 更新所有遮罩层
    updateOverlays(force) {
      if (!this.overlayManager) return;

      // 检查selectedCells是否发生变化
      if (
        force ||
        !this.arraysEqual(this.selectedCells, this.lastSelectedCells)
      ) {
        this.overlayManager.updateOverlayForType(
          "selection",
          this.selectedCells
        );
        this.lastSelectedCells = [...this.selectedCells];
      }

      // 检查copiedCells是否发生变化;
      if (force || !this.arraysEqual(this.copiedCells, this.lastCopiedCells)) {
        this.overlayManager.updateOverlayForType("copyDash", this.copiedCells);
        this.lastCopiedCells = [...this.copiedCells];
      }

      // 检查extendedCells是否发生变化
      if (
        force ||
        !this.arraysEqual(this.extendedCells, this.lastExtendedCells)
      ) {
        this.overlayManager.updateOverlayForType(
          "extended",
          this.extendedCells
        );
        this.lastExtendedCells = [...this.extendedCells];
      }
    },

    // ========== 事件管理 ==========

    // 移除所有事件
    removeAllEvents() {
      this.removeEvents();
      this.removeTempGlobalEvents();
    },

    // 添加临时全局事件监听器
    addTempGlobalEvents() {
      if (this.globalEventsAdded) return;
      document.addEventListener("mousemove", this.handleGlobalMouseMove);
      document.addEventListener("mouseup", this.handleGlobalMouseUp);
      this.globalEventsAdded = true;
    },

    // 移除全局事件监听器
    removeTempGlobalEvents() {
      if (!this.globalEventsAdded) return;

      document.removeEventListener("mousemove", this.handleGlobalMouseMove);
      document.removeEventListener("mouseup", this.handleGlobalMouseUp);
      this.globalEventsAdded = false;
    },

    // 初始化事件
    initEvents() {
      this.getTableElement().addEventListener("keydown", this.handleKeyDown);
      document.addEventListener("mousedown", this.handleGlobalMouseDown);
    },

    // 移除事件
    removeEvents() {
      this.getTableElement().removeEventListener("keydown", this.handleKeyDown);
      document.removeEventListener("mousedown", this.handleGlobalMouseDown);
    },
    // 键盘事件处理
    handleKeyDown(event) {
      const tableEl = this.getTableElement();
      if (!tableEl) return;

      // Ctrl+A 全选
      if (event.ctrlKey && event.key === "a") {
        // 检查全选权限
        if (!this.areaSelection.allSelection) {
          console.warn("全选操作被禁用");
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        // 全选
        const columnCount = getColumnCount(this.getTableElement());
        const rowCount = Math.max(this.rowCount, 1); // 至少选择1行，即使没有数据
        if (rowCount > 0 && columnCount > 0) {
          this.selectCells({
            minRow: 0,
            maxRow: rowCount - 1,
            minCol: 0,
            maxCol: columnCount - 1,
          });
        }
        return;
      }

      // Ctrl+Shift+C 复制带表头
      if (event.ctrlKey && event.shiftKey && event.key === "C") {
        // 检查复制权限
        if (!this.areaSelection.copy) {
          console.warn("复制操作被禁用");
          return;
        }
        this.copyCellsValues(false, true);
        return;
      }

      // Ctrl+C 复制
      if (event.ctrlKey && event.key === "c") {
        // 检查复制权限
        if (!this.areaSelection.copy) {
          console.warn("复制操作被禁用");
          return;
        }
        this.copyCellsValues();
      }

      // Ctrl+X 剪切
      if (event.ctrlKey && event.key === "x") {
        // 检查剪切权限（需要复制和粘贴权限）
        if (!this.areaSelection.cut) {
          console.warn("剪切操作被禁用");
          return;
        }
        event.preventDefault();
        this.copyCellsValues(true);
      }

      // Ctrl+V 粘贴
      if (event.ctrlKey && event.key === "v") {
        // 检查粘贴权限
        if (!this.areaSelection.paste) {
          console.warn("粘贴操作被禁用");
          return;
        }
        event.preventDefault();
        this.pasteCellsValues();
      }

      // Ctrl+Shift+Z 重做
      if (
        (event.ctrlKey && event.shiftKey && event.key === "Z") ||
        (event.ctrlKey && event.key === "y")
      ) {
        // 检查重做权限
        if (!this.areaSelection.redo) {
          console.warn("重做操作被禁用");
          return;
        }
        event.preventDefault();
        this.executeRedo();
        return;
      }

      // Ctrl+Z 撤销
      if (event.ctrlKey && event.key === "z") {
        // 检查撤销权限
        if (!this.areaSelection.undo) {
          console.warn("撤销操作被禁用");
          return;
        }
        event.preventDefault();
        this.executeUndo();
      }

      // Delete 或 Backspace 清空选中单元格
      if (event.key === "Delete" || event.key === "Backspace") {
        // 检查清空权限
        if (!this.areaSelection.clear) {
          console.warn("清空操作被禁用");
          return;
        }
        event.preventDefault();
        this.clearCells(this.selectedCells, "clear");
        return;
      }

      // Escape 清除选择
      if (event.key === "Escape") {
        this.clearCellSelection();
        this.updateOverlays();
      }
    },

    // 检测点击事件类型
    detectClickType(event, tableEl) {
      const target = event.target;

      // 检查是否点击填充手柄
      if (target.classList.contains("fill-handle")) {
        return { type: "fillHandle", target };
      }

      // 检查是否点击表头
      if (target.closest(".el-table__header")) {
        const cellInfo = getBoundaryCellFromMousePosition(event, tableEl);
        return { type: "header", target, cellInfo };
      }

      // 检查是否点击单元格
      if (target.closest(".el-table__body")) {
        const cellInfo = getBoundaryCellFromMousePosition(event, tableEl);
        if (cellInfo) {
          return { type: "cell", target, cellInfo };
        }
      }

      return { type: "unknown", target };
    },

    // 统一的文档点击事件处理
    handleGlobalMouseDown(event) {
      const tableEl = this.getTableElement();
      if (!tableEl) {
        return;
      }
      // 检查点击是否在表格内
      if (!isInnerCell(event, tableEl)) {
        // 点击在表格外部，清除所有选中
        this.clearCellSelection();
        this.copiedCells = [];
        this.updateOverlays();
        return;
      }

      // 只处理鼠标左键点击
      if (event.button !== 0) return;

      // 检查当前鼠标样式
      const cursor = window.getComputedStyle(event.target).cursor;
      if (
        cursor === "col-resize" ||
        cursor === "row-resize" ||
        cursor === "pointer"
      ) {
        return;
      }

      // 检测点击类型并分发处理
      const clickInfo = this.detectClickType(event, tableEl);
      this.dragState.startClickInfo = clickInfo;
      this.handleUnifiedMouseDown(event, clickInfo);

      tableEl.style.userSelect = "none";
    },

    // 统一的鼠标按下事件处理器
    handleUnifiedMouseDown(event, clickInfo) {
      const { type, cellInfo } = clickInfo;

      // 使用统一的全局事件处理器
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

        default:
          break;
      }
    },

    // 处理表头点击逻辑
    handleHeaderMouseDown(event, cellInfo) {
      if (!this.areaSelection.columnSelection) {
        console.warn("列选择操作被禁用");
        return;
      }

      this.dragState.type = "headerSelect";
      this.dragState.headerStartColumnIndex = cellInfo.columnIndex;

      // 选择整列 - 移除rowCount > 0的限制，因为即使没有数据也应该能选择列
      const rowCount = Math.max(this.rowCount, 1); // 至少选择1行，即使没有数据
      this.selectCells({
        minRow: 0,
        maxRow: rowCount - 1,
        minCol: cellInfo.columnIndex,
        maxCol: cellInfo.columnIndex,
      });
    },

    // 处理单元格点击逻辑
    handleCellMouseDown(event, cellInfo) {
      if (!cellInfo) return;

      this.dragState.type = "select";
      this.dragState.startCell = cellInfo;

      // 获取列配置信息
      const columnConfig = this.getColumnByIndex(cellInfo.columnIndex);

      // 检查列配置是否存在type属性，如果存在则选择整行
      if (
        columnConfig &&
        columnConfig.type === "index" &&
        this.areaSelection.rowSelection
      ) {
        // 获取rowspan属性，默认为1
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
            maxRow: cellInfo.rowIndex + rowspan - 1, // 根据rowspan选择多行
            minCol: 0,
            maxCol: columnCount - 1,
          });
        }
      } else {
        this.selectCells({
          minRow: cellInfo.rowIndex,
          maxRow: cellInfo.rowIndex,
          minCol: cellInfo.columnIndex,
          maxCol: cellInfo.columnIndex,
        });
      }
    },

    // 统一的全局鼠标移动事件处理器
    handleGlobalMouseMove(event) {
      const { type } = this.dragState;
      if (!type) return;

      // 检测边界并处理自动滚动
      const scrollDirection = detectScrollDirection(event, this.tableWrapper());

      // 表头拖拽不能进行上下滚动滚动
      if (this.dragState.startClickInfo.type === "header") {
        if (
          scrollDirection &&
          (scrollDirection.left || scrollDirection.right)
        ) {
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

      // 根据拖拽类型分发处理
      if (type === "fill") {
        this.handleFillDragMove(event);
      } else if (type === "headerSelect") {
        this.handleHeaderDragMove(event);
      } else if (type === "select") {
        this.handleCellDragMove(event);
      }
    },

    // 处理表头拖拽移动
    handleHeaderDragMove(event) {
      const columnIndex = getBoundaryCellFromMousePosition(
        event,
        this.getTableElement()
      )?.columnIndex;

      if (columnIndex === null || columnIndex === undefined) return;

      const { headerStartColumnIndex } = this.dragState;
      const minCol = Math.min(headerStartColumnIndex, columnIndex);
      const maxCol = Math.max(headerStartColumnIndex, columnIndex);

      // 整列选择 - 移除rowCount > 0的限制
      const rowCount = Math.max(this.rowCount, 1); // 至少选择1行，即使没有数据
      this.selectCells({
        minRow: 0,
        maxRow: rowCount - 1,
        minCol: minCol,
        maxCol: maxCol,
      });
    },

    // 处理单元格拖拽移动
    handleCellDragMove(event) {
      if (this.mouseMoveAnimationId) {
        cancelAnimationFrame(this.mouseMoveAnimationId);
      }

      this.mouseMoveAnimationId = requestAnimationFrame(() => {
        const cellInfo = getBoundaryCellFromMousePosition(
          event,
          this.getTableElement()
        );

        // 检查cellInfo是否与上次相同
        if (
          this.lastCellInfo &&
          cellInfo &&
          this.lastCellInfo.rowIndex === cellInfo.rowIndex &&
          this.lastCellInfo.columnIndex === cellInfo.columnIndex
        ) {
          return;
        }
        // 更新缓存
        this.lastCellInfo = cellInfo;

        if (cellInfo) {
          const { startCell } = this.dragState;
          this.dragState.endCell = cellInfo;

          // 检查起始列是否具有type属性
          const startColumnConfig = this.getColumnByIndex(
            startCell.columnIndex
          );

          if (startColumnConfig.type === "index") {
            // 如果起始列具有type属性，则按行选择
            const startRowIndex = Math.min(
              startCell.rowIndex,
              cellInfo.rowIndex
            );
            const endRowIndex = Math.max(startCell.rowIndex, cellInfo.rowIndex);

            // 获取起始单元格的rowspan以确定实际的结束行
            let startRowspan = 1;
            if (this.dragState.startCell.element) {
              const rowspanAttr =
                this.dragState.startCell.element.getAttribute("rowspan");
              if (rowspanAttr) {
                startRowspan = parseInt(rowspanAttr, 10) || 1;
              }
            }

            // 获取结束单元格的rowspan
            let endRowspan = 1;
            if (cellInfo.element) {
              const rowspanAttr = cellInfo.element.getAttribute("rowspan");
              if (rowspanAttr) {
                endRowspan = parseInt(rowspanAttr, 10) || 1;
              }
            }

            // 计算实际的结束行索引，考虑rowspan
            const actualEndRowIndex = Math.max(
              startRowIndex + startRowspan - 1,
              endRowIndex + endRowspan - 1
            );

            // 整行选择
            const columnCount = getColumnCount(this.getTableElement());
            if (columnCount > 0) {
              this.selectCells({
                minRow: startRowIndex,
                maxRow: actualEndRowIndex,
                minCol: 0,
                maxCol: columnCount - 1,
              });
            }
          } else {
            // 普通列按范围选择
            this.selectCells({
              minRow: Math.min(startCell.rowIndex, cellInfo.rowIndex),
              maxRow: Math.max(startCell.rowIndex, cellInfo.rowIndex),
              minCol: Math.min(startCell.columnIndex, cellInfo.columnIndex),
              maxCol: Math.max(startCell.columnIndex, cellInfo.columnIndex),
            });
          }
        }

        this.mouseMoveAnimationId = null;
      });
    },

    // 统一的全局鼠标抬起事件处理器
    handleGlobalMouseUp(event) {
      const { type } = this.dragState;
      if (!type) return;
      this.dragState.type = null;
      // 停止自动滚动
      this.stopAutoScroll();
      // 根据拖拽类型分发处理
      if (type === "fill") {
        this.handleFillDragEnd(event);
      } else if (type === "headerSelect") {
        // 清理表头拖拽状态
        this.dragState.headerStartColumnIndex = null;
        // 移除全局事件监听
        this.removeTempGlobalEvents();
      } else if (type === "select") {
        // 清理普通单元格拖拽状态
        this.dragState.endCell = null;
        // 清空拖拽缓存
        this.lastCellInfo = null;
        // 移除全局事件监听
        this.removeTempGlobalEvents();
      }
    },

    // 简化的选择函数
    selectCells({ minRow, maxRow, minCol, maxCol }) {
      const tableEl = this.getTableElement();
      if (!tableEl) return;

      this.clearCellSelection();

      let newSelectedCells = [...this.selectedCells];

      const addCellToSelection = (row, col) => {
        const cellInfo = createCellInfo(row, col);
        // 检查是否已存在相同的单元格
        const exists = newSelectedCells.some(
          (cell) => cell.rowIndex === row && cell.columnIndex === col
        );
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

      // 启动顶行监听器
      this.cellObserver.startObserving(this.selectedCells, "selected");

      this.$emit("excel-select", {
        selectedCells: this.selectedCells,
        bounds: { minRow, maxRow, minCol, maxCol },
      });
    },

    // 清除所有单元格选择
    clearCellSelection() {
      this.selectedCells = [];
      this.cellObserver.stopObserving();
    },

    // 销毁顶行监听器
    destroyCellObserver() {
      if (this.cellObserver) {
        this.cellObserver.stopObserving();
        this.cellObserver = null;
      }
    },

    // ==================== 复制黏贴相关方法 ====================

    // 复制选中单元格的值
    async copyCellsValues(isCut = false, includeHeaders = false) {
      try {
        if (!this.selectedCells.length) return;
        this.isCutMode = isCut;
        this.copiedCells = [...this.selectedCells];
        const cellsData = this.copiedCells.sort((a, b) => {
          if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
          return a.columnIndex - b.columnIndex;
        });

        const tableEl = this.getTableElement();
        const textRows = {}; // 存储文本值
        const valueTextRows = {}; // 存储转换后的实际值

        // 统一处理单元格数据收集
        cellsData.forEach((cell) => {
          const { rowIndex, columnIndex } = cell;
          if (!textRows[rowIndex]) textRows[rowIndex] = {};
          if (!valueTextRows[rowIndex]) valueTextRows[rowIndex] = {};

          // 获取文本（用于剪贴板）
          const element = getCellElement(tableEl, rowIndex, columnIndex);
          const cellText = getCellText(element) || "";
          // 调用自定义方法获取文本
          if (this.getCellTextMethod) {
            try {
              const row = this.getRowDataByIndex(rowIndex);
              const column = this.getColumnByIndex(columnIndex);
              textRows[rowIndex][columnIndex] = this.getCellTextMethod({
                row,
                column,
                rowIndex,
                columnIndex,
                element,
                cellText,
              });
            } catch (error) {
              console.error(cell, `自定义获取单元格文本出错:`, error);
              textRows[rowIndex][columnIndex] = cellText;
            }
          } else {
            textRows[rowIndex][columnIndex] = cellText;
          }
          textRows[rowIndex][columnIndex] = cellText;

          // 获取实际值（用于组件间复制）
          const cellValue =
            this.getCellValue(rowIndex, columnIndex, "copy") || cellText;
          let valueText = "";
          if (
            Array.isArray(cellValue) ||
            (typeof cellValue === "object" && cellValue !== null)
          ) {
            // 数组或对象直接保存为 JSON 字符串
            valueText = JSON.stringify(cellValue);
          } else {
            valueText = String(cellValue);
          }

          valueTextRows[rowIndex][columnIndex] = valueText;
        });

        // 使用通用方法转换数据
        let { textData } = convertRowsToTableData(textRows);
        const { textData: valueTextData } =
          convertRowsToTableData(valueTextRows);

        // 如果需要包含表头，在textData前面插入表头行
        if (includeHeaders) {
          const columnIndices = [
            ...new Set(cellsData.map((cell) => cell.columnIndex)),
          ].sort((a, b) => a - b);
          const headerTexts = columnIndices.map((columnIndex) =>
            getHeaderText(tableEl, columnIndex)
          );
          const headerLine = headerTexts.join("\t");
          textData = headerLine + "\n" + textData;
        }

        try {
          // 创建 JSON 数据
          const jsonData = {
            type: "super-crud-data",
            data: {
              valueTextRows: valueTextRows,
              textData: valueTextData,
              originalTextData: textData,
              timestamp: Date.now(),
            },
          };

          // 同时存储 text/plain 和 JSON 格式
          const clipboardItem = new ClipboardItem({
            "text/plain": new Blob([textData], { type: "text/plain" }),
            [applicationType]: new Blob([JSON.stringify(jsonData)], {
              type: applicationType,
            }),
          });

          await navigator.clipboard.write([clipboardItem]);
        } catch (error) {
          console.error("使用多格式剪贴板失败，降级到文本模式:", error);
          await navigator.clipboard.writeText(textData);
        }

        // 统一更新所有遮罩层状态
        this.updateOverlays();

        // 启动顶行监听器（针对复制的单元格）
        this.cellObserver.startObserving(this.copiedCells, "copied");

        this.$emit("excel-copy", {
          valueRows: valueTextRows,
          textRows: valueTextData,
          copiedCells: this.copiedCells,
          isCut: isCut,
          includeHeaders: includeHeaders,
        });
      } catch (error) {
        console.error("复制失败:", error);
      }
    },

    // 粘贴选中单元格的值
    async pasteCellsValues() {
      try {
        if (!this.selectedCells.length) return;
        const { textData, isInternal } = await readClipboardData(
          applicationType
        );

        const { affectedCells, pasteBounds } = this.applyPasteData(
          textData,
          this.selectedCells,
          isInternal
        );

        // 记录撤销历史
        if (affectedCells && affectedCells.length > 0) {
          this.recordUndoHistory("paste", affectedCells);
        }

        // 如果是剪切模式，清空原始单元格的值
        if (this.isCutMode) {
          await this.clearCells(this.copiedCells, "cut");
        }

        // 触发粘贴操作事件
        this.$emit("excel-paste", {
          pastedCells: affectedCells,
          isCutMode: this.isCutMode,
        });

        // 清除复制状态
        this.copiedCells = [];
        // 更新选中区域到粘贴范围
        this.selectCells(pasteBounds);
        this.updateOverlays();
      } catch (error) {
        console.error("粘贴失败:", error);
      }
    },

    // 清空剪切的原始单元格值
    async clearCells(cells, type) {
      try {
        const affectedCells = [];

        for (const cell of cells) {
          const { rowIndex, columnIndex } = cell;
          const { oldValue, clearValue } = this.setClearValue(
            rowIndex,
            columnIndex
          );
          affectedCells.push({
            rowIndex,
            columnIndex,
            oldValue,
            newValue: clearValue,
          });
        }

        // 记录撤销历史
        if (affectedCells.length > 0) {
          this.recordUndoHistory(type, affectedCells);
        }
        this.$emit("excel-clear", {
          clearedCells: affectedCells,
        });
      } catch (error) {
        console.error("清空剪切单元格失败:", error);
      }
    },

    // ==================== 扩展选中区域相关方法 ====================

    // 拖拽填充小方块鼠标按下事件
    handleFillHandleMouseDown(event) {
      if (!this.areaSelection.fill) {
        console.warn("填充操作被禁用");
        return;
      }
      const dragState = this.dragState;
      // 设置拖拽状态
      Object.assign(dragState, {
        type: "fill",
        fillDirection: null, // 重置拖拽方向
      });
      // 改变鼠标样式
      document.body.style.cursor = "crosshair";
    },

    // 拖拽填充移动事件
    handleFillDragMove(event) {
      const { fillDirection } = this.dragState;

      const cellInfo = getBoundaryCellFromMousePosition(
        event,
        this.getTableElement()
      );

      if (cellInfo) {
        const originalSelectionBounds = getCellsBounds(this.selectedCells);
        if (!originalSelectionBounds) return;

        const { rowIndex: currentRow, columnIndex: currentCol } = cellInfo;
        const { minRow, maxRow, minCol, maxCol } = originalSelectionBounds;

        // 确定拖拽方向（只在第一次移动时确定）
        if (fillDirection === null) {
          // 计算当前位置相对于选中区域边界的偏移
          const isOutsideRight = currentCol > maxCol;
          const isOutsideLeft = currentCol < minCol;
          const isOutsideBottom = currentRow > maxRow;
          const isOutsideTop = currentRow < minRow;

          // 计算水平和垂直方向的移动距离
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

          // 根据移动距离较大的方向确定拖拽方向
          if (verticalDistance > horizontalDistance && verticalDistance > 0) {
            this.dragState.fillDirection = "vertical";
          } else if (
            horizontalDistance > verticalDistance &&
            horizontalDistance > 0
          ) {
            this.dragState.fillDirection = "horizontal";
          } else {
            // 如果还在选中区域内或移动距离相等，暂时不确定方向
            return;
          }
        }

        // 根据确定的方向限制拖拽结束位置
        let constrainedCellInfo = { ...cellInfo };
        const currentFillDirection = this.dragState.fillDirection;

        if (currentFillDirection === "horizontal") {
          // 水平方向：保持在选中区域的行范围内，只允许列变化
          if (currentCol > maxCol) {
            // 向右扩展：使用选中区域的最后一行
            constrainedCellInfo.rowIndex = maxRow;
          } else if (currentCol < minCol) {
            // 向左扩展：使用选中区域的第一行
            constrainedCellInfo.rowIndex = minRow;
          }
        } else if (currentFillDirection === "vertical") {
          // 垂直方向：保持在选中区域的列范围内，只允许行变化
          if (currentRow > maxRow) {
            // 向下扩展：使用选中区域的最后一列
            constrainedCellInfo.columnIndex = maxCol;
          } else if (currentRow < minRow) {
            // 向上扩展：使用选中区域的第一列
            constrainedCellInfo.columnIndex = minCol;
          }
        }

        this.dragState.fillEndCell = constrainedCellInfo;

        const { rowIndex: dragRow, columnIndex: dragCol } = constrainedCellInfo;
        // 计算扩展区域边界
        const extendedBounds = {
          minRow: Math.min(minRow, dragRow),
          maxRow: Math.max(maxRow, dragRow),
          minCol: Math.min(minCol, dragCol),
          maxCol: Math.max(maxCol, dragCol),
        };
        // 生成扩展区域单元格列表
        const extendedCells = [];
        for (
          let row = extendedBounds.minRow;
          row <= extendedBounds.maxRow;
          row++
        ) {
          for (
            let col = extendedBounds.minCol;
            col <= extendedBounds.maxCol;
            col++
          ) {
            extendedCells.push(createCellInfo(row, col));
          }
        }
        this.extendedCells = extendedCells;
      }

      // 更新遮罩层显示
      this.updateOverlays();
    },

    // 拖拽填充结束事件
    handleFillDragEnd(event) {
      const { fillEndCell, fillDirection } = this.dragState;

      this.extendedCells = [];

      // 获取原始选中区域的边界
      const originalBounds = getCellsBounds(this.selectedCells);
      let fillCells = [];
      let fillResult = null;

      // 如果有填充结束单元格，计算填充区域的所有单元格
      if (fillEndCell && originalBounds) {
        // 计算填充区域的边界（包含原始选中区域和填充区域）
        const fillStartRow = Math.min(
          originalBounds.minRow,
          fillEndCell.rowIndex
        );
        const fillEndRow = Math.max(
          originalBounds.maxRow,
          fillEndCell.rowIndex
        );
        const fillStartCol = Math.min(
          originalBounds.minCol,
          fillEndCell.columnIndex
        );
        const fillEndCol = Math.max(
          originalBounds.maxCol,
          fillEndCell.columnIndex
        );

        // 提取表格元素，避免重复访问
        const tableEl = this.getTableElement();

        // 遍历填充区域内的所有单元格
        for (let row = fillStartRow; row <= fillEndRow; row++) {
          for (let col = fillStartCol; col <= fillEndCol; col++) {
            // 通过DOM检查单元格是否存在
            const cellElement = getCellElement(tableEl, row, col);
            if (cellElement) {
              fillCells.push({
                rowIndex: row,
                columnIndex: col,
                element: cellElement,
              });
            }
          }
        }

        // 检测是否按住Ctrl键（禁用智能填充）
        const disableSmartFill = event.ctrlKey || event.metaKey;

        // 执行填充操作
        const { affectedCells } = this.performFillOperation(
          originalBounds,
          fillCells,
          fillDirection,
          disableSmartFill
        );
        this.selectCells(getCellsBounds(fillCells));
      }

      // 移除全局事件监听器
      this.removeTempGlobalEvents();

      // 恢复鼠标样式
      document.body.style.cursor = "";

      // 重置拖拽状态
      Object.assign(this.dragState, {
        type: null,
        fillEndCell: null,
        fillDirection: null, // 重置拖拽方向
      });

      // 统一更新所有遮罩层状态
      this.updateOverlays();

      // 触发填充操作事件
      this.$emit("excel-fill", {
        fillCells,
      });
    },

    // ========== 撤销重做功能相关方法 ==========

    /**
     * 初始化撤销重做管理器
     */
    initUndoRedoManager() {
      this.undoRedoManager = new UndoRedoManager({
        maxSize: this.maxUndoSteps,
      });
    },

    // 记录操作历史
    recordUndoHistory(operationType, affectedCells) {
      this.undoRedoManager.recordHistory(operationType, affectedCells);
    },

    // 应用单元格值到表格数据
    applyCellValues(affectedCells, valueType = "newValue") {
      for (const cellData of affectedCells) {
        const { rowIndex, columnIndex } = cellData;
        const value = cellData[valueType];
        this.setCellValue(rowIndex, columnIndex, value, "undo");
      }

      // 更新选中区域到受影响的单元格
      if (affectedCells.length > 0) {
        this.selectCells(getCellsBounds(affectedCells));
      }
    },

    // 执行撤销操作
    async executeUndo() {
      const { affectedCells } = this.undoRedoManager.executeUndo();
      if (!affectedCells) return;
      this.applyCellValues(affectedCells, "oldValue");

      // 触发撤销操作事件
      this.$emit("excel-undo", {
        affectedCells: affectedCells,
      });
    },

    // 执行重做操作
    async executeRedo() {
      const { affectedCells } = this.undoRedoManager.executeRedo();
      if (!affectedCells) return;
      this.applyCellValues(affectedCells, "newValue");

      // 触发重做操作事件
      this.$emit("excel-redo", {
        affectedCells: affectedCells,
      });
    },
  },
  render(h) {
    return h(
      "div",
      {
        class: {
          "el-table-excel-wrapper": true,
        },
        attrs: {
          tabindex: "0",
        },
      },
      this.$slots.default
    );
  },
};
</script>
<style>
.el-table-excel-wrapper {
  outline: none;
}
/* 选中区域遮罩层样式 */
.el-table .cell-selection-overlay {
  position: absolute;
  display: none;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 3;
  background-color: rgba(64, 158, 255, 0.1);
  border: 1px solid #409eff;
  border-radius: 2px;
}

/* 填充小方块 */
.el-table .cell-selection-overlay .fill-handle {
  pointer-events: auto;
  position: absolute;
  right: 0;
  bottom: 0;
  width: 4px;
  height: 4px;
  background-color: #409eff;
  cursor: crosshair;
  z-index: 3;
  box-sizing: border-box;
  border-radius: 1px;
}

.el-table .cell-selection-overlay .fill-handle:hover {
  background-color: #40a9ff;
  transform: scale(1.2);
  box-shadow: 0 0 4px rgba(64, 158, 255, 0.5);
}

.el-table .cell-selection-overlay .fill-handle:active {
  background-color: #096dd9;
  transform: scale(1.1);
}

/* 复制虚线框样式 */
.el-table .copy-dash-overlay {
  position: absolute;
  display: none;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 3;
  background: transparent;
  border: 2px dashed #409eff;
  border-radius: 2px;
}

/* 扩展选中区域样式 */
.el-table .extended-selection-overlay {
  position: absolute;
  display: none;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 3;
  border: 2px dashed #909399;
  border-radius: 2px;
}

/* 左上角全选角标样式 - 三角形设计 */
.el-table .table-select-all-corner {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 10px 10px 0 0;
  border-color: #909399 transparent transparent transparent;
  cursor: pointer;
  z-index: 1002;
  box-sizing: border-box;
}

.el-table .table-select-all-corner:active {
  border-color: #409eff transparent transparent transparent;
}
</style>
