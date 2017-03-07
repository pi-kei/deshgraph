var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

var expression = '0';
var axes = [];
var sortedAxes = [];
var cols = 1;
var rows = 1;

function start() {
  var i;

  for (i = 0; i < axes.length; ++i) {
    sortedAxes[i] = axes[i];
    if (axes[i].vertical) {
      axes[i].span = rows;
      rows *= axes[i].valuesCount;
    } else {
      axes[i].span = cols;
      cols *= axes[i].valuesCount;
    }
  }

  sortedAxes.sort(function (a, b) {
    if (a.index < b.index) return -1;
    if (a.index > b.index) return 1;
    return 0;
  });

  sortedAxes[0].digitWeight = 1;
  for (i = 1; i < sortedAxes.length; ++i) {
    sortedAxes[i].digitWeight = sortedAxes[i - 1].digitWeight * sortedAxes[i - 1].valuesCount;
  }

  canvas.width = cols;
  canvas.height = rows;
}

canvas.onclick = function (e) {
  var rect = canvas.getBoundingClientRect();
  var col = e.clientX - rect.left;
  var row = e.clientY - rect.top;
  var coords = '';
  var i;
  var j;
  var index = 0;
  for (i = 0; i < sortedAxes.length; ++i) {
    j = (sortedAxes[i].vertical ? row : col) / sortedAxes[i].span % sortedAxes[i].valuesCount;
    if (!sortedAxes[i].forward) {
      j = sortedAxes[i].valuesCount - 1 - j;
    }
    index += j * sortedAxes[i].digitWeight;
    coords += (coords.length > 0 ? ' ' : '') + sortedAxes[i].name + '=' + (sortedAxes[i].startValue + j * sortedAxes[i].delta);
  }
  console.log('row=' + row + ' col=' + col + ' index=' + index + ' ' + coords);
};

var rectSize = 100;
var horRects = Math.ceil(cols / rectSize);
var verRects = Math.ceil(rows / rectSize);
var totalRects = horRects * verRects;
var currentRectIndex = [];
var totalWorkers = 4;

function getNextRect(index) {
  currentRectIndex[index] += totalWorkers;
  if (currentRectIndex[index] >= totalRects) {
    return { type: 'done' };
  }
  var y = Math.floor(currentRectIndex[index] / horRects) * rectSize;
  var x = (currentRectIndex[index] % horRects) * rectSize;
  return {
    type: 'drawRect',
    imageData: ctx.getImageData(x, y, rectSize, rectSize),
    x: x,
    y: y,
    w: rectSize,
    h: rectSize
  };
}

function messageHandler(e) {
  var message = e.data;
  var worker = e.target;
  if (message.type === 'init') {
    worker.postMessage(getNextRect(message.index));
  } else if (message.type === 'drawRect') {
    ctx.putImageData(message.imageData, message.x, message.y);
    worker.postMessage(getNextRect(message.index));
  } else if (message.type === 'error') {
    if (message.index === 0) {
      alert('Something wrong with expression or you did not add all axes');
    }
    worker.postMessage({ type: 'done' });
  }
}

function createWorkers() {
  if (!window.Worker) {
    return;
  }
  horRects = Math.ceil(cols / rectSize);
  verRects = Math.ceil(rows / rectSize);
  totalRects = horRects * verRects;
  currentRectIndex = [];
  var i;
  var worker;
  for (i = 0; i < totalWorkers; ++i) {
    worker = new Worker('deshgraph-worker.js');
    currentRectIndex[i] = i - totalWorkers;
    worker.onmessage = messageHandler;
    worker.postMessage({type: 'init', index: i, sortedAxes: sortedAxes, expression: expression});
  }
}

function axisToString(axis) {
  return axis.name +
    ' [' + axis.startValue + ', ' + (axis.startValue + axis.delta * axis.valuesCount) + '] ' +
    (axis.forward ? (axis.vertical ? '↓' : '→') : (axis.vertical ? '↑' : '←'));
}

document.getElementById('form').onsubmit = function (e) {
  e.preventDefault();

  if (axes.length == 0) {
    alert('Add axes');
    return;
  }

  e.target.style.display = 'none';
  expression = document.getElementById('expr').value;
  start();
  createWorkers();
};

document.getElementById('addAxisButton').onclick = function (e) {
  e.preventDefault();
  var name = document.getElementById('name').value;
  var startValue = parseFloat(document.getElementById('startValue').value);
  var endValue = parseFloat(document.getElementById('endValue').value);
  var valuesCount = parseInt(document.getElementById('valuesCount').value, 10);
  var vertical = document.getElementById('vertical').checked;
  var forward = document.getElementById('forward').checked;

  if (axes.filter(function (elem) { return elem.name === name; }).length > 0) {
    alert('Name must be unique');
    return;
  }

  if (startValue >= endValue) {
    alert('Start value must be less than end value');
    return;
  }

  var axis = {
    index: axes.length,
    name: name,
    startValue: startValue,
    valuesCount: valuesCount,
    delta: (endValue - startValue) / valuesCount,
    vertical: vertical,
    forward: forward,
    span: 1,
    digitWeight: 1
  };
  axes.push(axis);
  var option = document.createElement('option');
  option.text = axisToString(axis);
  var select = document.getElementById('axes');
  select.add(option);
};

document.getElementById('upButton').onclick = function (e) {
  e.preventDefault();
  var select = document.getElementById('axes');
  var selectedIndex = select.selectedIndex;
  if (selectedIndex < 0) {
    return;
  }
  if (selectedIndex == 0) {
    return;
  }
  var axis = axes[selectedIndex];
  axes[selectedIndex] = axes[selectedIndex - 1];
  axes[selectedIndex - 1] = axis;
  select.options[selectedIndex - 1].text = axisToString(axes[selectedIndex - 1]);
  select.options[selectedIndex].text = axisToString(axes[selectedIndex]);
};

document.getElementById('downButton').onclick = function (e) {
  e.preventDefault();
  var select = document.getElementById('axes');
  var selectedIndex = select.selectedIndex;
  if (selectedIndex < 0) {
    return;
  }
  if (selectedIndex == axes.length - 1) {
    return;
  }
  var axis = axes[selectedIndex];
  axes[selectedIndex] = axes[selectedIndex + 1];
  axes[selectedIndex + 1] = axis;
  select.options[selectedIndex + 1].text = axisToString(axes[selectedIndex + 1]);
  select.options[selectedIndex].text = axisToString(axes[selectedIndex]);
};

document.getElementById('removeButton').onclick = function (e) {
  e.preventDefault();
  var select = document.getElementById('axes');
  var selectedIndex = select.selectedIndex;
  if (selectedIndex < 0) {
    return;
  }
  var axis = axes.splice(selectedIndex, 1)[0];
  var i;
  for (i = 0; i < axes.length; ++i) {
    if (axes[i].index >= axis.index) {
      --axes[i].index;
    }
  }
  select.remove(select.selectedIndex);
};
