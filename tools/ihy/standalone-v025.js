(() => {
  'use strict';

  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context || !Context.prototype || !Context.prototype.createOscillator) return;

  const create = Context.prototype.createOscillator;
  Context.prototype.createOscillator = function (...args) {
    const node = create.apply(this, args);
    const previous = node.stop;
    let completed = false;

    node.stop = function (...stopArgs) {
      if (completed) return;
      completed = true;
      return previous.apply(node, stopArgs);
    };

    return node;
  };
})();