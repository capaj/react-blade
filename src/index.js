// sample every 10 milliseconds to generate the query
// this one works but its janky and i don't really like it

import React, { Timeout } from "react";
import parseBuffer from "./parseBuffer";
const cache = new Map();
let buffer = [];
let buffer_sub = new Map(); // requesting subtrees of the node
let buffer_vars = new Map(); // query variables for the node
let loopcount = 0;
function makeNewProxy(newTrace, obj) {
  return new Proxy(
    {
      __trace: newTrace,
      read() {
        console.log("getcache", cache, "buffer", buffer, 'newTrace', newTrace);
        if (cache.has(newTrace)) return cache.get(newTrace);
        if (buffer.includes(newTrace)) return "loading";
        if (loopcount++ < 20) {
          throw new Promise(resolve => {
            console.log('obj.__children', obj.__children, 'obj.__variables', obj.__variables, 'newTrace', newTrace)
            buffer.push(newTrace);
            resolve();
          });
        }
        return "you shouldnt see this";
      },
      subtree(children) {
        if (buffer_sub.has(newTrace)) return "loading";
        if (loopcount++ < 20) {
          throw new Promise(resolve => {
            buffer_sub.set(newTrace, children);
            resolve();
          });
        }
        return "you shouldnt see this";
      },
      vars(vars) {
        if (buffer_vars.has(newTrace)) return "loading";
        if (loopcount++ < 20) {
          throw new Promise(resolve => {
            buffer_vars.set(newTrace, vars);
            resolve();
          });
        }
        return "you shouldnt see this";
      },
      map(callback) {
        callback(makeNewProxy(newTrace, obj));
      }
    },
    handler
  );
}

var handler = {
  get: function (obj, prop, receiver) {
    console.log("getprop", typeof prop, prop, "|obj.trace", obj.__trace);
    // console.log("getcache", cache, "buffer", buffer);
    if (typeof prop === "symbol" || prop in Object.prototype || prop.slice(0, 2) === '__') return obj[prop];
    const newTrace = obj.__trace === "" ? `${prop}` : `${obj.__trace}.${prop}`;
    return prop in obj ? obj[prop] : makeNewProxy(newTrace, obj);
  }
};

// const qv = Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(',')
// obj.__trace = obj.__trace + `.${prop} {${value.toString()}}`

const query = new Proxy({ __trace: "" }, handler);

// use this if you want control over your own placeholder
export class ConnectWithoutPlaceholder extends React.Component {
  componentDidMount() {
    // i really dont want to have to make this setInterval.
    // with some user restrictions i wont have to
    setTimeout(() => {
      if (buffer.length) {
        console.log("buffer", buffer, 'buffer_sub', buffer_sub);
        const graphqlQuery = parseBuffer(buffer, buffer_sub, buffer_vars);
        // buffer = [] // buffer.clear()
        console.log("🔥🔥🔥🔥🔥graphqlQuery", graphqlQuery);
        this.forceUpdate();
      }
    }, 500);
  }
  render() {
    return <React.Fragment>{this.props.children({ query })}</React.Fragment>;
  }
}

// we choose to wrap ConnectWithoutPlaceholder as default because
// it is easy to mess up the placeholder placement
// and get a difficult-to-solve error:
// "Uncaught Error: A synchronous update was suspended, but no fallback UI was provided."
// Understand that picking one or the other as default behavior will make someone unhappy
// and we rather make beginners' life a tiny bit easier
export function Connect(props) {
  const {
    delayMs = 500,
    fallback = <div>react-blade Fallback Loading</div>,
    ...rest
  } = props;
  return (
    <Timeout ms={delayMs}>
      {didExpire =>
        didExpire ? fallback : <ConnectWithoutPlaceholder {...rest} />
      }
    </Timeout>
  );
}
