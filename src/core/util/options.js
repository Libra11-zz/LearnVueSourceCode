/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
// 这句代码就定义了 strats 变量，且它是一个常量，这个常量的值为 config.optionMergeStrategies，这个 config 对象是全局配置对象
// config.optionMergeStrategies 是一个合并选项的策略对象，
// 这个对象下包含很多函数，这些函数就可以认为是合并特定选项的策略。这样不同的选项使用不同的合并策略
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  // 非生产环境下在 strats 策略对象上添加两个策略(两个属性)分别是 el 和 propsData，且这两个属性的值是一个函数
  // 这两个策略函数是用来合并 el 选项和 propsData 选项的
  // trats.el 和 strats.propsData 这两个策略函数是只有在非生产环境才有的，在生产环境下访问这两个函数将会得到 undefined
  strats.el = strats.propsData = function (parent, child, vm, key) {
    // 如果策略函数中拿不到 vm 参数，那么处理的就是子组件的选项, 因为在子组件调用mergeOptions的时候，没有传递vm参数
    // 详见 core/global-api/extend.js 文件的 Vue.extend 方法
    // 如果没有传递这个参数，那么便会给你一个警告，提示你 el 选项或者 propsData 选项只能在使用 new 操作符创建实例的时候可用
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    // 直接调用了 defaultStrat 函数并返回
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
// 所以 mergeData 函数接收的两个参数就是两个纯对象
function mergeData(to: Object, from: ?Object): Object {
  // 如果没有 parentVal 产生的值，就直接使用 childVal 产生的值
  if (!from) return to
  let key, toVal, fromVal

  // Object.keys()返回属性key，但不包括不可枚举的属性
  // Reflect.ownKeys()返回所有属性key 包括Symbol
  const keys = hasSymbol
    ? Reflect.ownKeys(from)
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    // 如果 from 对象中的 key 不在 to 对象中，则使用 set 函数为 to 对象设置 key 及相应的值。
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      // 如果 from 对象中的 key 在 to 对象中，且这两个属性的值都是纯对象则递归地调用 mergeData 函数进行深度合并。
      mergeData(toVal, fromVal)
    }
  }
  // 将 from 对象的属性混合到 to 对象中，也可以说是将 parentVal 对象的属性混合到 childVal 中，最后返回的是处理后的 childVal 对象
  return to
}


/**
 *  为什么最终 strats.data 会被处理成一个函数？
    这是因为，通过函数返回数据对象，保证了每个组件实例都有一个唯一的数据副本，避免了组件间数据互相影响。
    Vue 的初始化的时候大家会看到，在初始化数据状态的时候，就是通过执行 strats.data 函数来获取数据并对其进行处理的。
 */



/**
 * Data
 */
export function mergeDataOrFn(
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    // 选项是在调用 Vue.extend 函数时进行合并处理的，此时父子 data 选项都应该是函数。
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    // mergeDataOrFn 函数在处理子组件选项时返回的总是一个函数，
    // 这也就间接导致 strats.data 策略函数在处理子组件选项时返回的也总是一个函数。
    return function mergedDataFn() {
      return mergeData(
        // childVal 要么是函数，要么就是一个纯对象。所以如果是函数的话就通过执行该函数从而获取到一个纯对象，
        // 所以类似上面那段代码中判断 childVal 和 parentVal 的类型是否是函数的目的只有一个，获取数据对象(纯对象)
        // 下同
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    return function mergedInstanceDataFn() {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

// 在 strats 策略对象上添加 data 策略函数，用来合并处理 data 选项
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // 判断是否传递了子组件的 data 选项(即：childVal)，并且检测 childVal 的类型是不是 function，
    // 如果 childVal 的类型不是 function 则会给你一个警告，
    // 也就是说 childVal 应该是一个函数，如果不是函数会提示你 data 的类型必须是一个函数
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      // 直接返回 parentVal
      return parentVal
    }
    // 最终都是调用 mergeDataOrFn 函数进行处理的，并且以 mergeDataOrFn 函数的返回值作为策略函数的最终返回值。
    return mergeDataOrFn(parentVal, childVal)
  }

  // 有一点不同的是在处理非子组件选项的时候所调用的 mergeDataOrFn 函数多传递了一个参数 vm
  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 *  new Vue({
      created: function () {
        console.log('created')
      }
    })
    如果以这段代码为例，那么对于 strats.created 策略函数来讲(注意这里的 strats.created 就是 mergeHooks)，
    childVal 就是我们例子中的 created 选项，它是一个函数。parentVal 应该是 Vue.options.created，
    但 Vue.options.created 是不存在的，所以最终经过 strats.created 函数的处理将返回一个数组：

    options.created = [
      function () {
        console.log('created')
      }  
    ]
    再看下面的例子：

    const Parent = Vue.extend({
      created: function () {
        console.log('parentVal')
      }
    })

    const Child = new Parent({
      created: function () {
        console.log('childVal')
      }
    })
    其中 Child 是使用 new Parent 生成的，所以对于 Child 来讲，childVal 是：

    created: function () {
      console.log('childVal')
    }
    而 parentVal 已经不是 Vue.options.created 了，而是 Parent.options.created，那么 Parent.options.created 是什么呢？它其实是通过 Vue.extend 函数内部的 mergeOptions 处理过的，所以它应该是这样的：

    Parent.options.created = [
      created: function () {
        console.log('parentVal')
      }
    ]
    所以这个例子最终的结果就是既有 childVal，又有 parentVal，那么根据 mergeHooks 函数的逻辑：

    function mergeHook (
      parentVal: ?Array<Function>,
      childVal: ?Function | ?Array<Function>
    ): ?Array<Function> {
      return childVal
        ? parentVal
          // 这里，合并且生成一个新数组
          ? parentVal.concat(childVal)
          : Array.isArray(childVal)
            ? childVal
            : [childVal]
        : parentVal
    }
    关键在这句：parentVal.concat(childVal)，将 parentVal 和 childVal 合并成一个数组。所以最终结果如下：

    [
      created: function () {
        console.log('parentVal')
      },
      created: function () {
        console.log('childVal')
      }
    ]
    另外我们注意第三个三目运算符：

    : Array.isArray(childVal)
      ? childVal
      : [childVal]
    它判断了 childVal 是不是数组，这说明什么？说明了生命周期钩子是可以写成数组的，虽然 Vue 的文档里没有，不信你可以试试：

    new Vue({
      created: [
        function () {
          console.log('first')
        },
        function () {
          console.log('second')
        },
        function () {
          console.log('third')
        }
      ]
    })
    钩子函数将按顺序执行，因此先执行父选项中的钩子函数，后执行子选项中的钩子函数。
 */
function mergeHook(
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  /**
   * return (是否有 childVal，即判断组件的选项中是否有对应名字的生命周期钩子函数)
      ? 如果有 childVal 则判断是否有 parentVal
        ? 如果有 parentVal 则使用 concat 方法将二者合并为一个数组
        : 如果没有 parentVal 则判断 childVal 是不是一个数组
          ? 如果 childVal 是一个数组则直接返回
          : 否则将其作为数组的元素，然后返回数组
      : 如果没有 childVal 则直接返回 parentVal
   */
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  return res
    ? dedupeHooks(res)
    : res
}

// 这个函数是为了剔除所有合并后钩子函数中的重复项
function dedupeHooks(hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}
// 使用 forEach 遍历 LIFECYCLE_HOOKS 常量
// 在 strats 策略对象上添加用来合并各个生命周期钩子选项的策略函数，并且这些生命周期钩子选项的策略函数相同：都是 mergeHook 函数
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 * 资源(assets)选项的合并策略
 * 在 Vue 中 directives、filters 以及 components 被认为是资源，其实很好理解，指令、过滤器和组件都是可以作为第三方应用来提供的
 */
/**
 *  大家知道任何组件的模板中我们都可以直接使用 <transition/> 组件或者 <keep-alive/> 等，
 * 但是我们并没有在我们自己的组件实例的 components 选项中显式地声明这些组件。那么这是怎么做到的呢？其实答案就在 mergeAssets 函数中。以下面的代码为例：

    var v = new Vue({
      el: '#app',
      components: {
        ChildComponent: ChildComponent
      }
    })
    上面的代码中，我们创建了一个 Vue 实例，并注册了一个子组件 ChildComponent，此时 mergeAssets 方法内的 childVal 就是例子中的 components 选项：

    components: {
      ChildComponent: ChildComponent
    }
    而 parentVal 就是 Vue.options.components，我们知道 Vue.options 如下：

    Vue.options = {
      components: {
        KeepAlive,
        Transition,
        TransitionGroup
      },
      directives: Object.create(null),
      directives:{
        model,
        show
      },
      filters: Object.create(null),
      _base: Vue
    }
    所以 Vue.options.components 就应该是一个对象：

    {
      KeepAlive,
      Transition,
      TransitionGroup
    }
    也就是说 parentVal 就是如上包含三个内置组件的对象，所以经过如下这句话之后：

    const res = Object.create(parentVal || null)
    你可以通过 res.KeepAlive 访问到 KeepAlive 对象，因为虽然 res 对象自身属性没有 KeepAlive，但是它的原型上有。

    然后再经过 return extend(res, childVal) 这句话之后，res 变量将被添加 ChildComponent 属性，最终 res 如下：

    res = {
      ChildComponent
      // 原型
      __proto__: {
        KeepAlive,
        Transition,
        TransitionGroup
      }
    }
    所以这就是为什么我们不用显式地注册组件就能够使用一些内置组件的原因，同时这也是内置组件的实现方式，通过 Vue.extend 创建出来的子类也是一样的道理，一层一层地通过原型进行组件的搜索
 */
function mergeAssets(
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  // 首先以 parentVal 为原型创建对象 res，然后判断是否有 childVal，
  // 如果有的话使用 extend 函数将 childVal 上的属性混合到 res 对象上并返回。如果没有 childVal 则直接返回 res。
  const res = Object.create(parentVal || null)
  if (childVal) {
    // 用来检测 childVal 是不是一个纯对象的，如果不是纯对象会给你一个警告
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

/**
 * 'component',
   'directive',
   'filter'
 */
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 * 在 strats 策略对象上添加 watch 策略函数。所以 strats.watch 策略函数应该是合并处理 watch 选项的
 * 被合并处理后的 watch 选项下的每个键值，有可能是一个数组，也有可能是一个函数。
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  // 在 Firefox 浏览器中 Object.prototype 拥有原生的 watch 函数，
  // 所以即便一个普通的对象你没有定义 watch 属性，但是依然可以通过原型链访问到原生的 watch 属性
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  // 检测了是否有 childVal，即组件选项是否有 watch 选项，如果没有的话，直接以 parentVal 为原型创建对象并返回(如果有 parentVal 的话)
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  // 判断是否有 parentVal，如果没有的话则直接返回 childVal，即直接使用组件选项的 watch
  if (!parentVal) return childVal
  // 如果存在 parentVal，那么代码继续执行，此时 parentVal 以及 childVal 都将存在，那么就需要做合并处理了
  // // 定义 ret 常量，其值为一个对象
  const ret = {}
  // // 将 parentVal 的属性混合到 ret 中，后面处理的都将是 ret 对象，最后返回的也是 ret 对象
  extend(ret, parentVal)
  // 遍历 childVal
  for (const key in childVal) {
    // 由于遍历的是 childVal，所以 key 是子选项的 key，父选项中未必能获取到值，所以 parent 未必有值
    let parent = ret[key]
    // child 是肯定有值的，因为遍历的就是 childVal 本身
    const child = childVal[key]
    // // 这个 if 分支的作用就是如果 parent 存在，就将其转为数组
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    // // 最后，如果 parent 存在，此时的 parent 应该已经被转为数组了，所以直接将 child concat 进去
    ret[key] = parent
      ? parent.concat(child)
      // // 如果 parent 不存在，直接将 child 转为数组返回
      : Array.isArray(child) ? child : [child]
  }
  // // 最后返回新的 ret 对象
  return ret
}

/**
 * Other object hashes.
 * 选项 props、methods、inject、computed 的合并策略
 * 对于 props、methods、inject 以及 computed 这四个选项有一个共同点，就是它们的结构都是纯对象
 * 虽然我们在书写 props 或者 inject 选项的时候可能是一个数组，但是 Vue 内部都将其规范化为了一个对象
 */
strats.props =
  strats.methods =
  strats.inject =
  strats.computed = function (
    parentVal: ?Object,
    childVal: ?Object,
    vm?: Component,
    key: string
  ): ?Object {
    // 如果存在 childVal，那么在非生产环境下要检查 childVal 的类型
    if (childVal && process.env.NODE_ENV !== 'production') {
      assertObjectType(key, childVal, vm)
    }
    // parentVal 不存在的情况下直接返回 childVal
    if (!parentVal) return childVal
    // 如果 parentVal 存在，则创建 ret 对象，然后分别将 parentVal 和 childVal 的属性混合到 ret 中，
    // 注意：childVal 将覆盖 parentVal 的同名属性
    const ret = Object.create(null)
    extend(ret, parentVal)
    if (childVal) extend(ret, childVal)
    // 最后返回 ret 对象。
    return ret
  }
// provide 选项的合并策略与 data 选项的合并策略相同，都是使用 mergeDataOrFn 函数
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 */
// 它是一个默认的策略，当一个选项不需要特殊处理的时候就使用默认的合并策略，
// 它的逻辑很简单：只要子选项不是 undefined 那么就是用子选项，否则使用父选项
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 */
function checkComponents(options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName(name: string) {
  // 组件的名字要满足正则表达式：/^[a-zA-Z][\w-]*$/
  // Vue 限定组件的名字由普通的字符和中横线(-)组成，且必须以字母开头
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  // isBuiltInTag 方法的作用是用来检测你所注册的组件是否是内置的标签
  // 还会检测是否是保留标签，即通过 config.isReservedTag 方法进行检测
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 * 将所有写法最终转化成如下写法
 * props: {
    someData:{
      type: null
    }
  }
 */
function normalizeProps(options: Object, vm: ?Component) {
  const props = options.props
  // 如果选项中没有 props 选项，则直接 return，什么都不做：
  if (!props) return
  // res 变量是用来保存规范化后的结果的，我们可以发现 normalizeProps 函数的最后一行代码使用 res 变量覆盖了原有的 options.props
  const res = {}
  let i, val, name
  // 这个判断分支就是用来区分开发者在使用 props 时，到底是使用字符串数组的写法还是使用纯对象的写法的
  if (Array.isArray(props)) {
    i = props.length
    // 遍历这个数组
    while (i--) {
      val = props[i]
      // 数组元素必须是字符串
      if (typeof val === 'string') {
        // 将-格式转为驼峰格式
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    /**
     * props: {
        // 第一种写法，直接写类型
        someData1: Number,
        // 第二种写法，对象
        someData2: {
          type: String,
          default: ''
        }
      }
     */
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      // val是纯对象直接使用,第一种写法，直接写类型
      // 如果不是纯对象则转为{type:val}, 第二种写法，对象
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // 当你传递了 props 选项，但其值既不是字符串数组又不是纯对象的时候，会给你一个警告：
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
function normalizeInject(options: Object, vm: ?Component) {
  // 使用 inject 变量缓存了 options.inject
  const inject = options.inject
  // 判断是否传递了 inject 选项，如果没有则直接 return
  if (!inject) return
  // 重写了 options.inject 的值为一个空的 JSON 对象，并定义了一个值同样为空 JSON 对象的变量 normalized。
  // 现在变量 normalized 和 options.inject 将拥有相同的引用，也就是说当修改 normalized 的时候，options.inject 也将受到影响
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      // ['data1', 'data2']
      // 由上面的结构转为下面的结构
      /**
       * {
            'data1': { from: 'data1' },
            'data2': { from: 'data2' }
          }
       */
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      /**
       * inject: {
          data1,
          d2: 'data2',
          data3: { someProperty: 'someValue' }
        }
        由上面的结构转为下面的结构
       * inject: {
          'data1': { from: 'data1' },
          'd2': { from: 'data2' },
          'data3': { from: 'data3', someProperty: 'someValue' }
        }
       */
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // 最后一个判断分支同样是在当你传递的 inject 选项既不是数组又不是纯对象的时候，在非生产环境下给你一个警告
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives(options: Object) {
  const dirs = options.directives
  if (dirs) {
    /**
     * test1: {
        bind: function () {
          console.log('v-test1')
        }
      },
      test2: function () {
        console.log('v-test2')
      }
     */
    for (const key in dirs) {
      const def = dirs[key]
      // 发现你注册的指令是一个函数的时候，则将该函数作为对象形式的 bind 属性和 update 属性的值
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType(name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
/**
 * parent options
 * Vue.options = {
    components: {
        KeepAlive,
        Transition,
        TransitionGroup
    },
    directives:{
        model,
        show
    },
    filters: Object.create(null),
    _base: Vue
  }
 */
export function mergeOptions(
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  // 这些工作是在非生产环境下做的，所以在非生产环境下开发者就能够发现并修正这些问题
  if (process.env.NODE_ENV !== 'production') {
    // 这个方法是用来校验组件的名字是否符合要求的
    checkComponents(child)
  }
  /**
   * 这说明 child 参数除了是普通的选项对象外，还可以是一个函数，如果是函数的话就取该函数的 options 静态属性作为新的 child，
   * 我们想一想什么样的函数具有 options 静态属性呢？现在我们知道 Vue 构造函数本身就拥有这个属性，
   * 其实通过 Vue.extend 创造出来的子类也是拥有这个属性的
   */
  if (typeof child === 'function') {
    child = child.options
  }

  // 三个用来规范化options的函数调用
  /**
   * 以 props 为例，我们知道在 Vue 中，我们在使用 props 的时候有两种写法，一种是使用字符串数组，如下
   * const ChildComponent = {
      props: ['someData']
    }
    另外一种是使用对象语法
    const ChildComponent = {
      props: {
        someData: {
          type: Number,
          default: 0
        }
      }
    }
   * 不仅仅是 props，在 Vue 中拥有多种使用方法的选项有很多，这给开发者提供了非常灵活且便利的选择，
   * 但是对于 Vue 来讲，这并不是一件好事儿，因为 Vue 要对选项进行处理，这个时候好的做法就是，
   * 无论开发者使用哪一种写法，在内部都将其规范成同一种方式，这样在选项合并的时候就能够统一处理，这就是上面三个函数的作用。
   */
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  if (!child._base) {
    // child.extends 是否存在，如果存在的话就递归调用 mergeOptions 函数将 parent 与 child.extends 进行合并
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    // child.mixins 选项是否存在，如果存在则使用同样的方式进行操作，不同的是，由于 mixins 是一个数组所以要遍历一下
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  // 第一句和最后一句说明了 mergeOptions 函数的的确确返回了一个新的对象
  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    // 作用是用来判断一个属性是否是对象自身的属性(不包括原型上的)。所以这个判断语句的意思是，
    // 如果 child 对象的键也在 parent 上出现，那么就不要再调用 mergeField 了，
    // 因为在上一个 for in 循环中已经调用过了，这就避免了重复调用。
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField(key) {
    // 第一句代码定义了一个常量 strat，它的值是通过指定的 key 访问 strats 对象得到的，而当访问的属性不存在时，则使用 defaultStrat 作为值。
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset(
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
