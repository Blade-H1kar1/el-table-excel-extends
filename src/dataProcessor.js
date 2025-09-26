import { get, set } from "lodash-es";
import {
  toTreeArray,
  getCellsBounds,
  getCellElement,
  findComponentInstance,
} from "./utils.js";
import { analyzePattern, generateSmartFillData } from "./smartFillEngine";

export default {
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
    },
  },
  methods: {
    getCellElement(rowIndex, columnIndex) {
      return getCellElement(this.getTableElement(), rowIndex, columnIndex);
    },
    getColumnByIndex(columnIndex) {
      const tableRef = findComponentInstance(this, "ElTable");
      const { store } = tableRef;
      const columns = store.states.columns || store.states._columns;
      return columns[columnIndex] || null;
    },
    // 根据索引获取对应的数据行
    getRowDataByIndex(rowIndex) {
      return this.flatTableData[rowIndex];
    },
    // 获取单元格组件实例
    getCellComponentInstance(rowIndex, columnIndex) {
      const cellElement = getCellElement(
        this.getTableElement(),
        rowIndex,
        columnIndex
      );
      const tableRef = findComponentInstance(this, "ElTable");

      // 获取表格实例的$children，最后一个为tbody组件实例
      const tableChildren = tableRef.$children;
      if (!tableChildren) return;
      const tbodyInstance = tableChildren[tableChildren.length - 1];
      if (!tbodyInstance) return;
      const rowInstance = tbodyInstance.$children[rowIndex];
      if (!rowInstance) return;

      // 遍历行组件实例的$children（单元格组件实例）
      const cellInstances = rowInstance.$children;
      for (let i = 0; i < cellInstances.length; i++) {
        const cellInstance = cellInstances[i];
        // 检查单元格组件实例的$el是否包含目标cellDom
        if (
          cellElement.contains(cellInstance.$el) ||
          cellInstance.$el === cellElement
        ) {
          return cellInstance;
        }
      }
    },
    // 响应式设置行数据
    setByProp(obj, prop, val) {
      if (!prop) return;
      // 处理数组路径 ['a', 'b'] 或字符串路径 'a.b'
      const path = Array.isArray(prop) ? prop : prop.split(".");
      if (path.length > 1) {
        if (!get(obj, path)) {
          // 绑定深层响应式对象
          path.slice(0, -1).reduce((obj, key, index) => {
            // 如果当前key值不存在，创建一个新响应式对象
            if (!obj[key] || typeof obj[key] !== "object") {
              this.$set(obj, key, {});
            }
            return obj[key];
          }, obj);

          // 获取最后一层的父对象
          const parentObj = path
            .slice(0, -1)
            .reduce((obj, key) => obj[key], obj);

          this.$set(parentObj, path[path.length - 1], val);
        } else {
          set(obj, path, val);
          this.$set(obj, path[0], obj[path[0]]);
        }
      } else {
        // 触发响应式更新
        this.$set(obj, prop, val);
      }
    },
    // 获取单元格的值
    getCellValue(rowIndex, columnIndex, type) {
      try {
        const row = this.getRowDataByIndex(rowIndex);
        const column = this.getColumnByIndex(columnIndex);

        if (!row || !column) return null;
        // 获取列的属性路径
        const prop = column?.property;

        // 调用自定义方法获取值
        if (this.getCellValueMethod) {
          return this.getCellValueMethod({
            row,
            column,
            rowIndex,
            columnIndex,
            value: prop && get(row, prop),
            type,
          });
        }
        if (!prop) return null;
        return get(row, prop);
      } catch (error) {
        console.error(`获取单元格值失败 (${rowIndex}, ${columnIndex}):`, error);
        return null;
      }
    },
    // 设置单元格的值
    setCellValue(rowIndex, columnIndex, value, type) {
      try {
        const row = this.getRowDataByIndex(rowIndex);
        const column = this.getColumnByIndex(columnIndex);

        const prop = column?.property;
        if (!row || !column || !prop) return false;
        // 调用自定义方法设置值
        if (this.setCellValueMethod) {
          this.setCellValueMethod(
            { row, column, rowIndex, columnIndex, value, type },
            this.setByProp.bind(this)
          );
          return true;
        }
        this.setByProp(row, prop, value);
        return true;
      } catch (error) {
        console.error(
          `应用单元格数据失败 (${rowIndex}, ${columnIndex}):`,
          error
        );
        return false;
      }
    },
    // 清空单元格的值
    setClearValue(rowIndex, columnIndex) {
      const oldValue = this.getCellValue(rowIndex, columnIndex, "clear");
      const getClearValueByType = (value, rowIndex, columnIndex) => {
        // 如果有自定义清空方法，优先使用
        if (this.getClearValueMethod) {
          const customClearValue = this.getClearValueMethod({
            value,
            rowIndex,
            columnIndex,
            row: this.getRowDataByIndex(rowIndex),
            column: this.getColumnByIndex(columnIndex),
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
      const success = this.setCellValue(
        rowIndex,
        columnIndex,
        clearValue,
        "clear"
      );
      if (success) {
        return {
          oldValue,
          clearValue,
        };
      }
      return {
        oldValue,
        clearValue: null,
      };
    },
    // 解析 JSON 值
    parseJSONValue(value) {
      let finalValue = value.trim();
      if (typeof finalValue === "string" && finalValue.trim()) {
        try {
          // 检查是否为 JSON 格式（以 { 或 [ 开头）
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

    // 自定义值映射转换
    applyTextValueMapping(value, rowIndex, columnIndex) {
      try {
        if (
          this.textMappingConfig &&
          Object.keys(this.textMappingConfig).length
        ) {
          const column = this.getColumnByIndex(columnIndex);

          const columnMapping = this.textMappingConfig[column.property];

          // 数组对象格式映射 [{ label: xxx, value: xxx }]
          if (Array.isArray(columnMapping)) {
            const matchedItem = columnMapping.find(
              (item) =>
                item &&
                typeof item === "object" &&
                (item.label === value ||
                  item.text === value ||
                  item.name === value)
            );
            if (matchedItem) return matchedItem.value;

            return value;
          }

          // 字符串值的直接映射
          if (typeof columnMapping === "object") {
            if (columnMapping.hasOwnProperty(value)) {
              return columnMapping[value];
            }
          }
        }

        if (this.customMapping) {
          const column = this.getColumnByIndex(columnIndex);
          const cellInstance = this.getCellComponentInstance(
            rowIndex,
            columnIndex
          );
          return this.customMapping(
            { value, column, rowIndex, columnIndex },
            cellInstance
          );
        }
        return value;
      } catch (error) {
        console.error(`文本值映射失败: ${error.message}`);
        return value;
      }
    },

    // ==================== 粘贴数据处理 ====================

    // 将剪贴板文本转化为结构化数据
    parseClipboardData(clipboardText, startRowIndex = 0, startColumnIndex = 0) {
      if (!clipboardText || typeof clipboardText !== "string") {
        return [];
      }
      const lines = clipboardText
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");
      const parsedData = [];

      lines.forEach((line, rowOffset) => {
        const cells = line.split("\t");
        cells.forEach((cellValue, colOffset) => {
          parsedData.push({
            value: cellValue,
            rowIndex: startRowIndex + rowOffset,
            columnIndex: startColumnIndex + colOffset,
            originalRowOffset: rowOffset,
            originalColumnOffset: colOffset,
          });
        });
      });

      return parsedData;
    },

    // 计算粘贴数据的维度信息
    getClipboardDataDimensions(clipboardText) {
      if (!clipboardText || typeof clipboardText !== "string") {
        return { rows: 0, columns: 0 };
      }

      const lines = clipboardText
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");
      const rows = lines.length;
      const columns =
        lines.length > 0
          ? Math.max(...lines.map((line) => line.split("\t").length))
          : 0;

      return { rows, columns };
    },

    // 计算粘贴数据的循环填充
    calculatePasteDataWithFill(
      clipboardData,
      clipboardDimensions,
      selectionBounds
    ) {
      const { rows: clipRows, columns: clipCols } = clipboardDimensions;
      const { minRow, maxRow, minCol, maxCol } = selectionBounds;

      const selectionRows = maxRow - minRow + 1;
      const selectionCols = maxCol - minCol + 1;

      // 当选中区域为单个单元格时，默认粘贴一次所有数据
      if (selectionRows === 1 && selectionCols === 1) {
        return clipboardData.map((cell) => ({
          ...cell,
          rowIndex: minRow + cell.originalRowOffset,
          columnIndex: minCol + cell.originalColumnOffset,
        }));
      }

      // 如果选中区域刚好是剪贴板数据的倍数，则进行重复填充
      const rowMultiplier =
        selectionRows % clipRows === 0 ? selectionRows / clipRows : 1;
      const colMultiplier =
        selectionCols % clipCols === 0 ? selectionCols / clipCols : 1;

      const filledData = [];

      for (let rowRepeat = 0; rowRepeat < rowMultiplier; rowRepeat++) {
        for (let colRepeat = 0; colRepeat < colMultiplier; colRepeat++) {
          clipboardData.forEach((cell) => {
            const newRowIndex =
              minRow + rowRepeat * clipRows + cell.originalRowOffset;
            const newColumnIndex =
              minCol + colRepeat * clipCols + cell.originalColumnOffset;

            // 确保不超出选中区域边界
            if (newRowIndex <= maxRow && newColumnIndex <= maxCol) {
              filledData.push({
                ...cell,
                rowIndex: newRowIndex,
                columnIndex: newColumnIndex,
              });
            }
          });
        }
      }

      return filledData;
    },

    // 应用粘贴数据到表格
    applyPasteData(pasteData, selectedCells, isInternal = false) {
      const selectionBounds = getCellsBounds(selectedCells);

      // 解析剪贴板数据
      const clipboardData = this.parseClipboardData(
        pasteData,
        selectionBounds.minRow,
        selectionBounds.minCol
      );

      if (clipboardData.length === 0) {
        return {
          success: false,
          message: "剪贴板数据为空",
        };
      }

      // 剪贴板的行数与列数
      const clipboardDimensions = this.getClipboardDataDimensions(pasteData);

      // 计算粘贴数据的循环填充
      pasteData = this.calculatePasteDataWithFill(
        clipboardData,
        clipboardDimensions,
        selectionBounds
      );
      const affectedCells = [];

      pasteData.forEach((cell) => {
        try {
          const { rowIndex, columnIndex, value } = cell;
          // 记录旧值用于撤销
          const oldValue = this.getCellValue(rowIndex, columnIndex, "undo");

          let processedValue = this.parseJSONValue(value);

          // 应用值映射转换（仅对外部数据）
          if (!isInternal) {
            processedValue = this.applyTextValueMapping(
              processedValue,
              rowIndex,
              columnIndex
            );
          }

          const success = this.setCellValue(
            rowIndex,
            columnIndex,
            processedValue,
            "paste"
          );
          if (success) {
            affectedCells.push({
              rowIndex,
              columnIndex,
              oldValue,
              newValue: processedValue,
            });
          }
        } catch (error) {
          console.error(cell, `单元格黏贴出错: ${error.message}`);
        }
      });
      return {
        affectedCells,
        pasteBounds: getCellsBounds(affectedCells),
      };
    },

    // ==================== 数据填充处理 ====================

    // 执行填充操作
    performFillOperation(
      originalBounds,
      fillCells,
      fillDirection,
      disableSmartFill = false
    ) {
      // 获取原始选中区域的数据
      const sourceData = this.getSourceDataForFill(originalBounds);

      // 生成填充数据
      const fillData = this.generateSmartFillData(
        sourceData,
        originalBounds,
        fillCells,
        disableSmartFill
      );

      // 应用填充数据到目标单元格
      const { affectedCells, fillBounds } = this.applyFillData(fillData);

      // 记录撤销历史
      if (affectedCells && affectedCells.length > 0) {
        this.recordUndoHistory("fill", affectedCells);
      }

      return {
        affectedCells,
        fillBounds,
        sourceData,
        fillData,
      };
    },

    // 获取源数据用于填充
    getSourceDataForFill(originalBounds) {
      const sourceData = [];
      const { minRow, maxRow, minCol, maxCol } = originalBounds;

      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const value = this.getCellValue(row, col, "fill");
          sourceData.push({
            rowIndex: row,
            columnIndex: col,
            value: value,
            relativeRow: row - minRow,
            relativeCol: col - minCol,
          });
        }
      }

      return sourceData;
    },

    // 生成智能填充数据
    generateSmartFillData(
      sourceData,
      originalBounds,
      fillCells,
      disableSmartFill = false
    ) {
      // 分析数据模式
      const pattern = analyzePattern(
        sourceData,
        this.areaSelection.fillCustomLists || {}
      );

      // 使用智能填充引擎生成数据
      return generateSmartFillData(
        pattern,
        sourceData,
        fillCells,
        originalBounds,
        disableSmartFill
      );
    },

    // 应用填充数据
    applyFillData(fillData) {
      const affectedCells = [];

      fillData.forEach((data) => {
        try {
          const { rowIndex, columnIndex, value } = data;
          const oldValue = this.getCellValue(rowIndex, columnIndex, "undo");

          const success = this.setCellValue(
            rowIndex,
            columnIndex,
            value,
            "fill"
          );
          if (success) {
            affectedCells.push({
              rowIndex,
              columnIndex,
              oldValue,
              newValue: value,
              originalValue: value,
              sourceValue: data.sourceValue,
            });
          }
        } catch (error) {
          console.error(data, `单元格填充出错: ${error.message}`);
        }
      });

      return {
        affectedCells,
        fillBounds: getCellsBounds(affectedCells),
      };
    },
  },
};
