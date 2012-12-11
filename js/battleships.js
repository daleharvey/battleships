"use strict";

var BOARD_SIZE = 10;

var BS = {};
BS.EMPTY = 0;
BS.HIT = 1;
BS.MISS = 2;

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
      return {
        sankShip: shipObj.dead,
        wonGame: allDead
      };
    }
    boardState[y][x] = BS.MISS;
    return false;
  };

  api.rotateSelectedShip = function() {
    if (selected) {
      ships[selected].vertical = !ships[selected].vertical;
    }
  };

  api.chooseRandomShipLocations = function() {
    ships = {
      sub: {
        dead: false,
        location: {x:0, y:0},
        size: 2,
        vertical: false,
        hits: 0
      },
      battleShip: {
        dead: false,
        location: {x:0, y: 0},
        size: 4,
        vertical: false,
        hits: 0
      }
    };

    for (var ship in ships) {
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
        var ship = api.shipAtSquare(x, y);

        var square = document.createElement('div');
        square.setAttribute('data-x', x);
        square.setAttribute('data-y', y);
        square.textContent = state;

        if (ship) {
          if (showShips) {
            square.classList.add('ship');
            square.textContent = 's';
          }

          if (ship === selected) {
            square.classList.add('selected');
          }
        }
        if (state === BS.HIT) {
          square.classList.add('hit');
          square.textContent = 'X';
        }

        if (state === BS.MISS) {
          square.classList.add('miss');
          square.textContent = '1';
        }

        wrapper.appendChild(square);
      }
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

  var shotListener;
  var listener;

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
        api.takeAITurn();
      }
    } else {
      if (player) {
        state(PLAYER2_TURN);
        api.takeAITurn();
      } else {
        state(PLAYER1_TURN);
      }
    }
  };

  function fisherYates ( myArray ) {
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

  api.newGame = function() {
    player1 = new BattleShipBoard();
    player2 = new BattleShipBoard();
    player1.chooseRandomShipLocations();
    player2.chooseRandomShipLocations();
    state(CHOOSING_POSITIONS);
    api.redraw();
  };

  api.startGame = function() {
    state(PLAYER1_TURN);
  };

  var playerTurns = {};
  var randomTurns = [];

  for (var y = 0; y < BOARD_SIZE; y++) {
    for (var x = 0; x < BOARD_SIZE; x++) {
      randomTurns.push({x:x, y:y});
    }
  }
  fisherYates(randomTurns);

  api.takeAITurn = function() {
    var turn = randomTurns.pop();
    var result = player1.takeShot(turn.x, turn.y);
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
      if (!(key in playerTurns)) {
        playerTurns[key] = true;
        var result = player2.takeShot(x, y);
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
    'view-my-board', 'battleships', 'present'
  ];

  var battleships = new BattleShips();
  var boardShown = null;
  var blockSize = 0;

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
      dom.gameStatus.textContent = 'Take your turn';
      showBoard(false);
    } else if (state === PLAYER2_TURN) {
      dom.gameStatus.textContent = 'Opponents Turn';
      showBoard(true);
    } else if (state === PLAYER_WON) {
      dom.gameStatus.textContent = 'Yay you won';
      battleships.redraw(true);
      showBoard(false);
    } else if (state === PLAYER_LOST) {
      dom.gameStatus.textContent = 'doh you lost';
      battleships.redraw(true);
      showBoard(false);
    }
  });

  battleships.onShotTaken(function(player, x, y, result) { 
    
    var complete = function() { 
      dom.present.removeEventListener('transitionend', complete, true);
      dom.gameStatus.textContent = result === false ? 'Miss!' : 'Hit!';
      battleships.redraw();
      setTimeout(function() { 
        dom.present.style.display = 'none';
        dom.present.clientTop;
        battleships.shotTakenResult(player, result);      
      }, 2000);
    };

    dom.present.style.left = x * blockSize + 'px';
    dom.present.style.top = y * blockSize - 100 + 'px';
    dom.present.style.display = 'block';

    dom.present.clientTop;
    dom.present.style.left = x * blockSize + 'px';
    dom.present.style.top = y * blockSize + 'px';

    dom.present.addEventListener('transitionend', complete, true);
  });

  api.windowResize = function() {
    blockSize = Math.floor(dom.battleships.clientWidth / 10);
    dom.battleships.style.height = dom.battleships.clientWidth + 'px';
  };

  window.addEventListener('resize', api.windowResize);
  api.windowResize();
  battleships.newGame();

  return api;

})();
