/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI(Vue: GlobalAPI) {
  // config
  // 在 Vue 构造函数上添加 config 属性
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // 这里有一段注释，大概意思是 Vue.util 以及 util 下的四个方法都不被认为是公共API的一部分，
  // 要避免依赖他们，但是你依然可以使用，只不过风险你要自己控制。
  // 并且，在官方文档上也并没有介绍这个全局API，所以能不用尽量不要用
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 在 Vue 上添加了四个属性分别是 set、delete、nextTick 以及 options，
  // 这里要注意的是 Vue.options，现在它还只是一个空的对象，通过 Object.create(null) 创建。
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }
  </T>

  Vue.options = Object.create(null)

  // 执行后变成下面这样
  // Vue.options = {
  //   components: {
  //     KeepAlive
  //   },
  //   directives: Object.create(null),
  //   filters: Object.create(null),
  //   _base: Vue
  // }
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  // 这句代码的意思就是将 builtInComponents 的属性混合到 Vue.options.components 中
  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
