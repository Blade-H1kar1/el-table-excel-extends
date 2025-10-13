# el-table-excel-extends

一个为 Element UI 表格提供 Excel 类似功能的 Vue 组件，支持区域选择、复制粘贴、智能填充、撤销重做等丰富的表格操作功能。

在线示例: https://blade-h1kar1.github.io/el-table-excel-extends

## 功能特性

- ✅ **区域选择**: 支持单元格、行、列、全表的灵活选择
- ✅ **复制粘贴**: 支持单元格、行、列的复制粘贴操作，兼容Excel格式
- ✅ **智能填充**: 类似 Excel 的拖拽填充功能，支持多种智能模式：数值序列、日期序列、文本+数字序列、自定义列表序列和复制模式
- ✅ **撤销重做**: 支持操作历史的撤销和重做
- ✅ **键盘快捷键**: 支持 Ctrl+C、Ctrl+V、Ctrl+Z、Ctrl+A 等快捷键
- ✅ **自动滚动**: 选择区域超出视窗时自动滚动

## 安装

```bash
npm install el-table-excel-extends
```

## 快捷键

| 快捷键                   | 功能       | 说明                         |
| ------------------------ | ---------- | ---------------------------- |
| **选择操作**             |            |                              |
| 鼠标拖拽                 | 区域选择   | 拖拽选择单元格区域           |
| 点击表头                 | 列选择     | 选择整列数据                 |
| 点击序号                 | 行选择     | 选择整行数据                 |
| Ctrl+A                   | 全选       | 选择所有单元格               |
| Escape                   | 取消选择   | 清除当前选择                 |
| **编辑操作**             |            |                              |
| Ctrl+C                   | 复制       | 复制选中单元格内容           |
| Ctrl + Shift + C         | 复制带表头 | 复制选中区域的数据并携带表头 |
| Ctrl+X                   | 剪切       | 剪切选中单元格内容           |
| Ctrl+V                   | 粘贴       | 粘贴内容到选中区域           |
| Delete        | 清空       | 清空选中单元格内容           |
| **撤销重做**             |            |                              |
| Ctrl+Z                   | 撤销       | 撤销上一步操作               |
| Ctrl+Y、Ctrl + Shift + Z | 重做       | 重做下一步操作               |
| **填充操作**             |            |                              |
| 拖拽填充柄               | 智能填充   | 拖拽右下角小方块进行智能填充 |
| Ctrl + 拖拽填充柄        | 复制填充   | 按住Ctrl键拖拽进行复制填充   |

## 配置参数

| 参数                | 类型     | 默认值 | 说明                                                     |
| ------------------- | -------- | ------ | -------------------------------------------------------- |
| copy                | Boolean  | true   | 是否启用复制功能                                         |
| paste               | Boolean  | true   | 是否启用粘贴功能                                         |
| cut                 | Boolean  | true   | 是否启用剪切功能                                         |
| fill                | Boolean  | true   | 是否启用智能填充功能                                     |
| fillCustomLists     | Array    | []     | 自定义填充列表，用于智能填充的自定义序列                 |
| undo                | Boolean  | true   | 是否启用撤销功能                                         |
| redo                | Boolean  | true   | 是否启用重做功能                                         |
| selection           | Boolean  | true   | 是否启用区域选择功能                                     |
| allSelection        | Boolean  | true   | 是否启用全选功能（Ctrl+A）                               |
| rowSelection        | Boolean  | true   | 是否启用行选择（点击序号列）                             |
| columnSelection     | Boolean  | true   | 是否启用列选择（点击表头）                               |
| autoScroll          | Boolean  | true   | 是否启用自动滚动                                         |
| scrollSpeed         | Number   | 10     | 自动滚动速度（像素/帧）                                  |
| maxUndoSteps        | Number   | 50     | 最大撤销步数                                             |
| getCellTextMethod   | Function | -      | 自定义获取单元格文本的方法（复制文本）                   |
| getCellValueMethod  | Function | -      | 自定义获取单元格值的方法（表格间值复制、获取值）         |
| getClearValueMethod | Function | -      | 自定义返回清空值的方法                                   |
| setCellValueMethod  | Function | -      | 自定义设置单元格值的方法，可通过type参数判断操作类型     |
| textMappingConfig   | Object   | -      | 文本映射配置对象（外部Excel文本黏贴时映射到表格的值）    |
| customMapping       | Function | -      | 自定义文本映射函数 （外部Excel文本黏贴时映射到表格的值） |

## 事件

| 事件名       | 参数                                   | 说明               |
| ------------ | -------------------------------------- | ------------------ |
| excel-copy   | { copiedCells, isCut, includeHeaders } | 复制操作完成时触发 |
| excel-paste  | { pastedCells, isCutMode }             | 粘贴操作完成时触发 |
| excel-clear  | { clearedCells, clearType }            | 清空单元格时触发   |
| excel-fill   | { fillCells }                          | 填充操作完成时触发 |
| excel-undo   | { affectedCells }                      | 撤销操作完成时触发 |
| excel-redo   | { affectedCells }                      | 重做操作完成时触发 |
| excel-select | { selectedCells, bounds }              | 选择区域变化时触发 |

## 方法

| 方法名                                          | 说明                                   |
| ----------------------------------------------- | -------------------------------------- |
| getCellComponentInstance(rowIndex, columnIndex) | 获取指定单元格的组件实例               |
| getCellElement(rowIndex, columnIndex)           | 获取指定单元格的DOM                    |
| getColumnByIndex(columnIndex)                   | 获取指定列配置                         |
| getRowDataByIndex(rowIndex)                     | 获取指定行数据（适用于树级）           |
| updateOverlays                                  | 更新所有遮罩层（适用于遮罩层样式错乱） |
| clearCellSelection                              | 清除当前选择                           |
| selectCells({ minRow, maxRow, minCol, maxCol }) | 选择指定区域                           |

## 基础用法

```vue
<template>
  <el-table-excel-extends>
    <el-table
      ref="table"
      :data="tableData"
      border
      height="400"
    >
      <el-table-column prop="name" label="姓名" width="120">
      </el-table-column>
      <el-table-column prop="age" label="年龄" width="100">
      </el-table-column>
      <el-table-column prop="status" label="状态" width="120">
      </el-table-column>
    </el-table>
  </el-table-excel-extends>
</template>

<script>
import ElTableExcelExtends from 'el-table-excel-extends'

export default {
  components: {
    ElTableExcelExtends
  },
}
</script>
```

## 自定义方法

### 自定义单元格处理

通过自定义方法可以实现数据验证、权限控制、格式转换等功能：

```vue
<template>
  <el-table-excel-extends
    :get-cell-text-method="getCellText"
    :get-cell-value-method="getCellValue"
    :set-cell-value-method="setCellValue"
    :get-clear-value-method="getClearValue"
  >
    <el-table :data="tableData">
      <el-table-column prop="id" label="ID" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="age" label="年龄" />
      <el-table-column prop="status" label="状态" />
      <el-table-column prop="tags" label="标签" />
    </el-table>
  </el-table-excel-extends>
</template>

<script>
export default {
  methods: {
    // 自定义复制文本
    getCellText({ row, column, rowIndex, columnIndex, element, value }) {
      return value
    },
    // 获取单元格值 - 处理复杂组件的值获取
    getCellValue({ row, column, rowIndex, columnIndex, value, type }) {
      // 根据操作类型进行不同处理
      console.log('操作类型:', type) // type可能的值: 'copy', 'fill', 'clear', 'undo'
      return value
    },
    
    // 设置单元格值 - 数据验证和权限控制
    setCellValue({ row, column, rowIndex, columnIndex, value, type }, setByProp) {
      // 根据操作类型进行不同处理
      console.log('操作类型:', type) // type可能的值: 'paste', 'fill', 'clear', 'undo', 'redo'
      
      // 针对不同操作类型的处理
      if (type === 'paste') {
        // 粘贴操作的特殊处理
        console.log('这是粘贴操作')
      } else if (type === 'fill') {
        // 填充操作的特殊处理
        console.log('这是填充操作')
      } else if (type === 'clear') {
        // 清空操作的特殊处理
        console.log('这是清空操作')
      }
      
      // 禁用某些列的编辑（粘贴、填充等操作）
      if (column.property === 'id') {
        this.$message.warning('ID列不允许编辑')
        return
      }
      
      // 数据验证
      if (column.property === 'age') {
        const age = Number(value)
        if (isNaN(age) || age < 0 || age > 150) {
          this.$message.warning('年龄必须在0-150之间')
          return
        }
        value = age
      }
      
      // 处理复杂数据类型
      if (column.property === 'tags' && typeof value === 'string') {
        value = value.split(', ').filter(tag => tag.trim()) // 字符串转数组
      }
      
      // 设置值
      setByProp(row, column.property, value)
    },
    
    // 获取清空值 - 根据数据类型返回合适的空值
    getClearValue({ row, column, rowIndex, columnIndex, value }) {
      const clearValues = {
        'status': false,    // 布尔类型清空为false
        'age': 0,          // 数字类型清空为0
        'tags': [],        // 数组类型清空为空数组
        'score': null      // 可为空的数字清空为null
      }
      
      return clearValues[column.property] // 返回undefined使用默认清空逻辑
    }
  }
}
</script>
```

## 智能填充详细说明

智能填充功能支持多种模式，能够根据选中数据的模式自动识别并生成相应的填充数据。

### 支持的填充模式

#### 1. 数值序列填充

**等差数列**：自动识别数字间的等差关系并延续
```
选中: 1, 3, 5
拖拽填充: 7, 9, 11, 13...
```

**等比数列**：自动识别数字间的等比关系并延续
```
选中: 2, 4, 8
拖拽填充: 16, 32, 64, 128...
```

#### 2. 日期序列填充

支持常见日期格式的智能识别和填充：
```
选中: 2024-01-01, 2024-01-02
拖拽填充: 2024-01-03, 2024-01-04, 2024-01-05...

选中: 2024/01/01, 2024/01/03
拖拽填充: 2024/01/05, 2024/01/07, 2024/01/09...
```

#### 3. 文本+数字序列填充

自动识别文本前缀+数字后缀的模式：
```
选中: 项目1, 项目2, 项目3
拖拽填充: 项目4, 项目5, 项目6...

选中: Task10, Task15
拖拽填充: Task20, Task25, Task30...
```

#### 4. 自定义列表序列填充

通过配置 `fillCustomLists` 属性支持自定义序列：
```vue
<template>
  <el-table-excel-extends :fill-custom-lists="customLists">
    <el-table :data="tableData">
      <!-- 表格列定义 -->
    </el-table>
  </el-table-excel-extends>
</template>

<script>
export default {
  data() {
    return {
      customLists: [
        ['春', '夏', '秋', '冬'],           // 季节序列
        ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], // 星期序列
        ['A', 'B', 'C', 'D', 'E'],         // 字母序列
        ['红', '橙', '黄', '绿', '蓝', '靛', '紫'] // 颜色序列
      ]
    }
  }
}
</script>
```

使用示例：
```
选中: 春, 夏
拖拽填充: 秋, 冬, 春, 夏... (循环)

选中: 周一, 周三
拖拽填充: 周五, 周日, 周二, 周四... (按步长2)
```

#### 5. 复制模式填充

当数据无法识别为特定模式时，或按住 Ctrl 键拖拽时，使用复制模式：
```
选中: A, B, C
Ctrl + 拖拽填充: A, B, C, A, B, C... (循环复制)
```


## 文本映射配置

当从外部（如Excel、文本）粘贴数据到表格时，可以配置文本到值的映射关系：

```vue
<template>
  <el-table-excel-extends
    :text-mapping-config="mappingConfig"
    :custom-mapping="customMapping"
  >
    <el-table :data="tableData">
      <!-- 表格列定义 -->
    </el-table>
  </el-table-excel-extends>
</template>

<script>
export default {
  data() {
    return {
      // 外部Excel文本映射到表格值
      mappingConfig: {
        status: {
          '启用': true,
          '禁用': false,
          '是': true,
          '否': false
        },
        level: {
          '初级': 1,
          '中级': 2,
          '高级': 3
        }
      }
    }
  },
  methods: {
    // 自定义映射函数（优先级高于mappingConfig）
    customMapping({ value, column, rowIndex, columnIndex }, cellInstance) {
      // cellInstance 为当前单元格实例
      // 日期格式处理
      if (column.property === 'joinDate') {
        const date = new Date(value)
        return isNaN(date.getTime()) ? null : date
      }
      
      // 数字格式处理
      if (column.property === 'salary') {
        return parseFloat(value.replace(/[^\d.-]/g, '')) || 0
      }
      
      return value // 返回原值表示不处理
    }
  }
}
</script>
```