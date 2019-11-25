/* @flow */

import { toArray } from '../util/index'

export function initUse(Vue: GlobalAPI) {
  // 该方法的作用是在 Vue 构造函数上添加 use 方法，也就是传说中的 Vue.use 这个全局API，
  // 这个方法大家应该不会陌生，用来安装 Vue 插件。
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
