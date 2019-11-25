/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin(Vue: Class<Component>) {
  // 这个方法的作用就是在 Vue 的原型上添加了 _init 方法，这个 _init 方法看上去应该是内部初始化的一个方法
  Vue.prototype._init = function (options?: Object) {

    // 首先声明了常量 vm，其值为 this 也就是当前这个 Vue 实例
    const vm: Component = this
    // a uid
    // 在实例上添加了一个唯一标示：_uid，其值为 uid，uid 这个变量定义在 initMixin 方法的上面，
    // 初始化为 0，可以看到每次实例化一个 Vue 实例之后，uid 的值都会 ++
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    // 在非生产环境下，并且 config.performance 和 mark 都为真，那么才执行里面的代码
    /*
    Vue 提供了全局配置 Vue.config.performance，我们通过将其设置为 true，即可开启性能追踪，你可以追踪四个场景的性能：
      1、组件初始化(component init)
      2、编译(compile)，将模板(template)编译成渲染函数
      3、渲染(render)，其实就是渲染函数的性能，或者说渲染函数执行且生成虚拟DOM(vnode)的性能
      4、打补丁(patch)，将虚拟DOM渲染为真实DOM的性能
    在初始化的代码的开头和结尾分别使用 mark 函数打上两个标记，然后通过 measure 函数对这两个标记点进行性能计算
    */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    /*
    首先在 Vue 实例上添加 _isVue 属性，并设置其值为 true。目的是用来标识一个对象是 Vue 实例，
    即如果发现一个对象拥有 _isVue 属性并且其值为 true，那么就代表该对象是 Vue 实例。
    这样可以避免该对象被响应系统观测（其实在其他地方也有用到，但是宗旨都是一样的，
    这个属性就是用来告诉你：我不是普通的对象，我是Vue实例）。
    */
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // 这段代码在 Vue 实例上添加了 $options 属性  这个属性用于当前 Vue 的初始化
      // 方法的内部大家可以看到一系列 init* 的方法, 这些方法才是真正起作用的一些初始化方法，
      // 在这些初始化方法中，无一例外的都使用到了实例的 $options 属性
      /**
       * vm.$options = mergeOptions(
          {
            components: {
              KeepAlive
              Transition,
              TransitionGroup
            },
            directives:{
              model,
              show
            },
            filters: Object.create(null),
            _base: Vue
          },
          {
            el: '#app',
            data: {
              test: 1
            }
          },
          vm
      )
       */
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 解析构造者的 options
export function resolveConstructorOptions(Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
