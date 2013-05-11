"use strict";

var BOARD_SIZE = 10;

var BS = {};
BS.EMPTY = 0;
BS.HIT = 1;
BS.MISS = 2;

var ShipDef = {
  sub: {
    name: 'Submarine',
    size: 3
  },
  battleship: {
    name: 'BattleShip',
    size: 4
  },
  carrier: {
    name: 'Carrier',
    size: 5
  },
  destroyer: {
    name: 'Destroyer',
    size: 3
  },
  patrol: {
    name: 'Patrol',
    size: 2
  }
};

var blockSize = 0;

var BattleShipBoard = function() {

  var api = {};
  var ships = {};
  var boardState = {};
  var shotsTaken = [];
  var selected;

  for (var y = 0; y < BOARD_SIZE; y++) {
    boardState[y] = [];
    for (var x = 0; x < BOARD_SIZE; x++) {
      boardState[y][x] = BS.EMPTY;
    }
  }

  api.takeShot = function(x, y) {
    shotsTaken.push({x:x, y:y});
    var ship = api.shipAtSquare(x, y);
    if (ship) {
      boardState[y][x] = BS.HIT;
      var shipObj = ships[ship];
      shipObj.hits++;
      if (shipObj.hits === shipObj.size) {
        shipObj.dead = true;
      }
      var allDead = true;
      for (var name in ships) {
        allDead = allDead && ships[name].dead;
      }
      return {wonGame: allDead, ship: shipObj};
    }
    boardState[y][x] = BS.MISS;
    return false;
  };

  api.rotateSelectedShip = function() {
    if (selected) {
      ships[selected].vertical = !ships[selected].vertical;
      var canMove = api.moveShip(selected,
                                 ships[selected].location.x,
                                 ships[selected].location.y);
      // If we cant move to the new position (puts us off board or blocked by
      // another ship) then revert the rotation
      if (!canMove) {
        ships[selected].vertical = !ships[selected].vertical;
      }
    }
  };

  api.chooseRandomShipLocations = function() {
    for (var ship in ShipDef) {
      ships[ship] = JSON.parse(JSON.stringify(ShipDef[ship]));
      ships[ship].location = {x: 0, y: 0};
      ships[ship].vertical = false;
      ships[ship].dead = false;
      ships[ship].hits = 0;
      var positioned = false;
      while (!positioned) {
        ships[ship].vertical = !Math.round(Math.random());
        positioned = api.moveShip(ship, Math.round(Math.random() * 9),
                                  Math.round(Math.random() * 9));
      }
    }
  };

  api.moveShip = function(ship, x, y) {
    var points = [];
    var size = ships[ship].size;

    for (var i = 0; i < size; i++) {
      var point = ships[ship].vertical ? {x: x, y: y + i} : {x: x + i, y: y};
      points.push(point);
    }


    var blocked = false;
    points.forEach(function(point) {
      var insideBounds = point.x < BOARD_SIZE && point.x >= 0 &&
        point.y < BOARD_SIZE && point.y >= 0;
      var shiptmp = api.shipAtSquare(point.x, point.y);
      var blockedByShip = shiptmp !== false && shiptmp !== ship;
      if (!blocked) {
        blocked = !insideBounds || blockedByShip;
      }
    });

    if (!blocked) {
      ships[ship].location = {x: x, y: y};
      return true;
    }
    return false;
  };

  api.moveSelectedShip = function(x, y) {
    api.moveShip(selected, x, y);
  };

  api.selectedShip = function() {
    return selected;
  };

  api.shipAtSquare = function(x, y) {
    for (var name in ships) {
      var ship = ships[name];
      var size = ship.size;
      var xy = ship.location;

      while (--size >= 0) {
        var point = ship.vertical ?
          {x: xy.x, y: xy.y + size} : {x: xy.x + size, y: xy.y};
        if (point.y === y && point.x === x) {
          return name;
        }
      }
    }
    return false;
  };

  api.selectShip = function(ship) {
    selected = ship;
  };

  api.drawBoard = function(wrapper, showShips) {
    wrapper.innerHTML = '';
    for (var y = 0; y < BOARD_SIZE; y++) {
      for (var x = 0; x < BOARD_SIZE; x++) {
        var state = boardState[y][x];
        var square = document.createElement('div');
        square.setAttribute('data-x', x);
        square.setAttribute('data-y', y);
        square.classList.add('square');

        if (state === BS.HIT) {
          square.classList.add('hit');
        }

        if (state === BS.MISS) {
          square.classList.add('miss');
        }
        wrapper.appendChild(square);
      }
    }

    for (var name in ships) {
      var ship = ships[name];

      if (!showShips && !ship.dead) {
        continue;
      }

      var shipElement = document.createElement('div');
      shipElement.classList.add('ship');
      shipElement.classList.add(name);
      if (api.selectedShip() === name) {
        shipElement.classList.add('selected');
      }
      shipElement.style.top = ship.location.y * blockSize + 'px';
      shipElement.style.left = ship.location.x * blockSize + 'px';
      shipElement.style.width = ship.size * blockSize + 'px';
      shipElement.style.height = blockSize + 'px';

      if (ship.vertical) {
        shipElement.classList.add('vertical');
        shipElement.style.left = ship.location.x * blockSize + blockSize + 'px';
      }
      wrapper.appendChild(shipElement);
    }
  };

  return api;
};

var INIT = 'init';
var CHOOSING_POSITIONS = 'choosing-positions';
var PLAYER1_TURN = 'player1-turn';
var PLAYER2_TURN = 'player2-turn';
var PLAYER_WON = 'player-won';
var PLAYER_LOST = 'player-lost';

var BattleShips = function() {

  var api = {};

  var playing = INIT;
  var player1;
  var player2;

  var hasTakenShot = false;

  var shotListener;
  var listener;

  var playerTurns = {};
  var randomTurns = [];
  var hitList = [];

  var shotTimer;

  function state(state) {
    playing = state;
    if (listener) {
      listener.apply(this, [playing]);
    }
  }

  api.shotTakenResult = function(player, result) {
    if (result.wonGame) {
      state(player ? PLAYER_WON : PLAYER_LOST);
      return;
    }

    if (result !== false) {
      if (!player) {
        shotTimer = setTimeout(api.takeAITurn, 2000);
      } else {
        hasTakenShot = false;
      }
    } else {
      if (player) {
        shotTimer = setTimeout(function() {
          state(PLAYER2_TURN);
          api.takeAITurn();
        }, 2000);
      } else {
        shotTimer = setTimeout(function() {
          state(PLAYER1_TURN);
          hasTakenShot = false;
        }, 2000);
      }
    }
  };

  function fisherYates(myArray) {
    var i = myArray.length;
    if (i === 0) {
      return false;
    }
    while (--i) {
      var j = Math.floor(Math.random() * (i + 1));
      var tempi = myArray[i];
      var tempj = myArray[j];
      myArray[i] = tempj;
      myArray[j] = tempi;
    }
  }

  function shotTaken(player, x, y, result) {
    shotListener(player, x, y, result);
  }

  // Find the first adjacent square(north / south / east west) of point
  function findAdjacent(point, turns) {
    var p, i;
    for (i = 0; i < turns.length; i++) {
      p = turns[i];
      var isAdjacent =
        (p.x === point.x && (p.y === (point.y + 1) || p.y === (point.y - 1))) ||
        (p.y === point.y && (p.x === (point.x + 1) || p.x === (point.x - 1)));

      if (isAdjacent) {
        return p;
      }
    }
    return false;
  }

  // Pretty ugly, find the 2 square at either end of the path formed by
  // 'points', pick the first left in turns
  function findPath(points, turns) {
    var axis = points[0].x === points[1].x ? 'y' : 'x';
    var otherAxis = axis === 'x' ? 'y' : 'x';
    var start = {}, end = {};
    var p, i, min, max;
    min = max = points[0][axis];
    for (i = 0; i < points.length; i++) {
      min = Math.min(points[i][axis], min);
      max = Math.max(points[i][axis], max);
    }
    start[axis] = min - 1;
    start[otherAxis] = points[0][otherAxis];
    end[axis] = max + 1;
    end[otherAxis] = points[0][otherAxis];
    for (i = 0; i < turns.length; i++) {
      p = turns[i];
      if (p.x === start.x && p.y === start.y ||
          p.x === end.x && p.y === end.y) {
        return p;
      }
    }
    return false;
  }

  // This is a pretty simple AI that tries to guess the next best shot if the
  // previous shots were hits, if we hit adjoining ships then it will get confused
  // and start again, with no previous hits its just random.
  function pickNextShot() {
    var point = false;
    if (hitList.length === 1) {
      // If we have previously hit a ship once, then pick the next adjacent
      // spot
      point = findAdjacent(hitList[0], randomTurns);
    } else if (hitList.length > 1) {
      // If we have had more than 1 previous hit, pick the first point along the same
      // path
      point = findPath(hitList, randomTurns);
    }
    if (point) {
      randomTurns = randomTurns.filter(function(p) {
        return !(p.x === point.x && p.y === point.y);
      });
    }
    return point;
  }

  api.newGame = function() {

    if (shotTimer) {
      clearTimeout(shotTimer);
    }
    hasTakenShot = false;

    player1 = new BattleShipBoard();
    player2 = new BattleShipBoard();

    playerTurns = {};
    randomTurns = [];

    for (var y = 0; y < BOARD_SIZE; y++) {
      for (var x = 0; x < BOARD_SIZE; x++) {
        randomTurns.push({x:x, y:y});
      }
    }
    fisherYates(randomTurns);

    player1.chooseRandomShipLocations();
    player2.chooseRandomShipLocations();
    player1.selectShip('carrier');
    state(CHOOSING_POSITIONS);
    api.redraw();
  };

  api.startGame = function() {
    player1.selectShip(null);
    api.redraw();
    state(PLAYER1_TURN);
  };

  api.takeAITurn = function() {
    var turn = pickNextShot();
    // We cant find any more points searching for the current ship
    if (!turn) {
      hitList = [];
      turn = randomTurns.pop();
    }
    var result = player1.takeShot(turn.x, turn.y);
    if (result !== false) {
      if (result.ship.dead) {
        hitList = [];
      } else {
        hitList.push(turn);
      }
    }

    shotTaken(false, turn.x, turn.y, result);
  };

  api.squareSelected = function(playersBoard, x, y) {
    if (playersBoard && playing === CHOOSING_POSITIONS) {
      var ship = player1.shipAtSquare(x, y);
      if (!ship && player1.selectedShip()) {
        player1.moveSelectedShip(x, y);
      } else if (ship) {
        player1.selectShip(ship);
      }
      api.redraw();
    } else if (!playersBoard && playing === PLAYER1_TURN) {
      var key = x + ':' + y;
      if (!(key in playerTurns) && !hasTakenShot) {
        playerTurns[key] = true;
        var result = player2.takeShot(x, y);
        hasTakenShot = true;
        shotTaken(true, x, y, result);
      }
    }
  };

  api.redraw = function(showOppenent) {
    player1.drawBoard(document.getElementById('board-mine'), true);
    player2.drawBoard(document.getElementById('board-opponent'), !!showOppenent);
  };

  api.onStateChange = function(callback) {
    listener = callback;
  };

  api.onShotTaken = function(callback) {
    shotListener = callback;
  };

  api.player = function() {
    return player1;
  };

  return api;
};

var BattleShipUI = (function() {

  var api = {};
  var dom = {};
  var ids = [
    'new-game', 'board-mine', 'board-opponent', 'clear-selection', 'game-status',
    'start-game', 'random-positions', 'rotate-ship', 'controls', 'view-opponents-board',
    'view-my-board', 'battleships', 'present', 'restart-game'
  ];

  var battleships = new BattleShips();
  var boardShown = null;

  function showBoard(players) {
    var newBoard = players ? dom.boardMine : dom.boardOpponent;
    if (players) {
      dom.viewMyBoard.classList.add('selected');
      dom.viewOpponentsBoard.classList.remove('selected');
    } else {
      dom.viewOpponentsBoard.classList.add('selected');
      dom.viewMyBoard.classList.remove('selected');
    }

    if (boardShown !== newBoard) {
      if (boardShown) {
        boardShown.style.display = 'none';
      }
      newBoard.style.display = 'block';
      boardShown = newBoard;
    }
  }

  api.newGame = function() {
    battleships.newGame();
  };

  api.startGame = function() {
    battleships.startGame();
  };

  api.boardPressed = function(e) {
    var x = parseInt(e.target.getAttribute('data-x'), 10);
    var y = parseInt(e.target.getAttribute('data-y'), 10);
    var playersBoard = e.target.parentNode.getAttribute('id') === 'board-mine';
    battleships.squareSelected(playersBoard, x, y);
  };

  api.randomPositions = function(e) {
    battleships.player().chooseRandomShipLocations();
    battleships.redraw();
  };

  api.rotatePressed = function(e) {
    battleships.player().rotateSelectedShip();
    battleships.redraw();
  };

  api.clearSelection = function(e) {
    battleships.player().selectShip(null);
    battleships.redraw();
  };

  api.viewOpponentsBoard = function() {
    showBoard(false);
  };

  api.viewMyBoard = function() {
    showBoard(true);
  };

  function toCamelCase(str) {
    return str.replace(/\-(.)/g, function replacer(str, p1) {
      return p1.toUpperCase();
    });
  }

  ids.forEach(function(name) {
    dom[toCamelCase(name)] = document.getElementById(name);
  });

  dom.newGame.addEventListener('mousedown', api.newGame);
  dom.boardMine.addEventListener('mousedown', api.boardPressed);
  dom.boardOpponent.addEventListener('mousedown', api.boardPressed);
  dom.rotateShip.addEventListener('mousedown', api.rotatePressed);
  dom.randomPositions.addEventListener('mousedown', api.randomPositions);
  dom.clearSelection.addEventListener('mousedown', api.clearSelection);
  dom.startGame.addEventListener('mousedown', api.startGame);
  dom.restartGame.addEventListener('mousedown', api.newGame);

  dom.viewMyBoard.addEventListener('mousedown', api.viewMyBoard);
  dom.viewOpponentsBoard.addEventListener('mousedown', api.viewOpponentsBoard);

  var prevState;
  battleships.onStateChange(function(state) {
    if (prevState) {
      document.body.classList.remove(prevState);
      prevState = null;
    }
    document.body.classList.add(state);
    prevState = state;

    if (state === CHOOSING_POSITIONS) {
      dom.gameStatus.textContent = 'Pick Positions';
      showBoard(true);
    } else if (state === PLAYER1_TURN) {
      dom.gameStatus.textContent = 'SELECT TARGET';
      showBoard(false);
    } else if (state === PLAYER2_TURN) {
      dom.gameStatus.textContent = 'ENEMY TURN';
      showBoard(true);
    } else if (state === PLAYER_WON) {
      if (promptTimer) clearTimeout(promptTimer);
      dom.gameStatus.textContent = 'Yay you won';
      battleships.redraw(true);
      showBoard(false);
    } else if (state === PLAYER_LOST) {
      if (promptTimer) clearTimeout(promptTimer);
      dom.gameStatus.textContent = 'doh you lost';
      battleships.redraw(true);
      showBoard(false);
    }
  });

  var promptTimer;
  battleships.onShotTaken(function(player, x, y, result) {
    var hasRun = false;
    var complete = function() {
      if (hasRun) return;
      hasRun = true;
      dom.present.removeEventListener('transitionend', complete, true);
      dom.present.removeEventListener('webkitTransitionEnd', complete, true);
      if (result === false) {
        dom.gameStatus.textContent = 'Miss';
      } else {
        dom.gameStatus.textContent = result.ship.dead ?
          'You sunk my ' + result.ship.name : 'Hit!';
        promptTimer = setTimeout(function() {
          dom.gameStatus.textContent = 'Another turn';
        }, 2000);
      }
      dom.present.style.display = 'none';
      dom.present.clientTop;
      battleships.redraw();
      battleships.shotTakenResult(player, result);
    };

    dom.present.style.left = x * blockSize + 6 + 'px';
    dom.present.style.top = y * blockSize - 150 + 'px';
    dom.present.style.display = 'block';

    dom.present.clientTop;
    dom.present.style.left = x * blockSize + 6 + 'px';
    dom.present.style.top = y * blockSize + 'px';

    dom.present.addEventListener('transitionend', complete, true);
    dom.present.addEventListener('webkitTransitionEnd', complete, true);
  });

  api.windowResize = function() {
    blockSize = Math.floor(dom.battleships.clientWidth / 10);
    dom.battleships.style.height = dom.battleships.clientWidth + 'px';
  };

  window.addEventListener('resize', api.windowResize);
  api.windowResize();
  battleships.newGame();

  // The first time someone visits this game in a device that supports
  // installation, ask if they want to install it.
  if (navigator.mozApps && !localStorage.getItem('checkedInstall')) {
    localStorage.setItem('checkedInstall', 'true');

    var request = navigator.mozApps.getSelf();
    request.onsuccess = function() {
      if (!this.result) {
        var install = confirm('Do you want to install BattleShips?');
        if (install) {
          var manifestUrl = location.protocol + "//" + location.host + location.pathname + "manifest.webapp";
          navigator.mozApps.install(manifestUrl);
        }
      }
    }
  }

  return api;

})();
