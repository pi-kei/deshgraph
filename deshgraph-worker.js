importScripts('http://cdnjs.cloudflare.com/ajax/libs/mathjs/3.9.3/math.min.js');

var sortedAxes;
var iterations;
var values;
var scope;
var compiledExpression;
var index;

function init(message) {
  sortedAxes = message.sortedAxes;
  iterations = sortedAxes.length * sortedAxes.length;
  values = [];
  scope = {};
  index = message.index;

  try {
    compiledExpression = math.parse(message.expression).compile();
    var i;
    for (i = 0; i < sortedAxes.length; ++i) {
      values[i] = sortedAxes[i].startValue;
      scope[sortedAxes[i].name] = sortedAxes[i].startValue;
    }
    compiledExpression.eval(scope);
  } catch (error) {
    return { type: 'error', index: index };
  }

  return { type: 'init', index: index };
}

function calculate(col, row) {
  var i;
  var j;
  var funcMin = Number.POSITIVE_INFINITY;
  var funcMax = Number.NEGATIVE_INFINITY;
  var funcValue;
  for (i = 0; i < sortedAxes.length; ++i) {
    j = (sortedAxes[i].vertical ? row : col) / sortedAxes[i].span % sortedAxes[i].valuesCount;
    if (!sortedAxes[i].forward) {
      j = sortedAxes[i].valuesCount - 1 - j;
    }
    values[i] = sortedAxes[i].startValue + j * sortedAxes[i].delta;
  }
  for (i = 0; i < iterations; ++i) {
    for (j = 0; j < sortedAxes.length; ++j) {
      scope[sortedAxes[j].name] = values[j] + ((i >>> j) & 1) * sortedAxes[j].delta;
    }
    funcValue = compiledExpression.eval(scope);
    if (funcValue < funcMin) funcMin = funcValue;
    if (funcValue > funcMax) funcMax = funcValue;
  }
  return funcMin <= 0.0 && funcMax >= 0.0;
}

function checkGrid(col, row) {
  var i;
  var j;
  var valueMin;
  var valueMax;
  for (i = 0; i < sortedAxes.length; ++i) {
    if (sortedAxes[i].span !== 1) {
      continue;
    }
    j = (sortedAxes[i].vertical ? row : col) / sortedAxes[i].span % sortedAxes[i].valuesCount;
    if (!sortedAxes[i].forward) {
      j = sortedAxes[i].valuesCount - 1 - j;
    }
    valueMin = sortedAxes[i].startValue + j * sortedAxes[i].delta;
    valueMax = valueMin + sortedAxes[i].delta;
    if (valueMin <= 0.0 && valueMax >= 0.0) {
      return true;
    }
  }
  return false;
}

function drawRect(message) {
  var imageData = message.imageData;
  var x = message.x;
  var y = message.y;
  var w = message.w;
  var h = message.h;
  var data = imageData.data;
  var i;
  var j;
  for (i = 0; i < w; ++i) {
    for (j = 0; j < h; ++j) {
      if (calculate(x + i, y + j)) {
        data[(j * w + i) * 4 + 3] = 255;
      } else if (checkGrid(x + i, y + j)) {
        data[(j * w + i) * 4 + 3] = 63;
      }
    }
  }
  return { type: 'drawRect', index: index, imageData: imageData, x: x, y: y };
}

self.onmessage = function (e) {
  var message = e.data;
  if (message.type === 'init') {
    self.postMessage(init(message));
  } else if (message.type === 'drawRect') {
    self.postMessage(drawRect(message));
  } else if (message.type === 'done') {
    self.close();
  }
};
