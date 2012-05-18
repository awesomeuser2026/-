/**
 * Map - Provides map, player and hex objects
 *
 * http://www.linuxconsulting.ro
 * http://openpanzer.net
 *
 * Copyright (c) 2012 Nicu Pavel
 * Licensed under the GPL license:
 * http://www.gnu.org/licenses/gpl.html
 */

//Hex, Player and Map classes
function Player()
{
	this.id = -1;
	this.side = -1;
	this.country = -1;
	this.prestige = 0;
	this.playedTurn = -1;
	
	//Clone object
	this.copy = function(p)
	{
		if (p === null) return;
		this.id = p.id;
		this.side = p.side;
		this.country = p.country;
		this.prestige = p.prestige;
		this.playedTurn = p.playedTurn;
	}
	this.getCountryName = function() { return countryNames[this.country]; }
}

function Hex(row, col)
{
	this.unit = null; //pointer to the ground unit on this hex
	this.airunit = null; //pointer to the air unit on this hex
	this.terrain = terrainType.Clear;
	this.road = roadType.none;
	this.owner = -1;
	this.flag = -1;
	this.isSupply = false;
	this.isDeployment = false;
	this.victorySide = -1; //hex is a victory point for side [0,1]
	this.name = "";

	this.isMoveSel = false; //current unit can move to this hex
	this.isAttackSel = false; //current unit can attack this hex
	
	//Clone object
	this.copy = function(hex) 
	{
		if (hex === null) return;
		
		this.terrain = hex.terrain;
		this.road = hex.road;
		this.owner = hex.owner;
		this.flag = hex.flag;
		this.isSupply = hex.isSupply;
		this.isDeployment = hex.isDeployment;
		this.victorySide = hex.victorySide;
		this.name = hex.name;
		
		//Set units and their correct links to the new object
		this.setUnit(hex.unit);
		this.setUnit(hex.airunit);
	}
	
	this.getPos = function() { return new Cell(1 * r, 1 * c); }
	
	//Returns air or ground unit on a hex depending on UI airMode 
	this.getUnit = function(airMode)
	{
		if (this.unit !== null && this.airunit !== null)
		{
			if (airMode)
				return this.airunit;
			else
				return this.unit;
		}
	
		if (this.unit !== null)
			return this.unit;
		
		if (this.airunit !== null)
			return this.airunit;
	
		return null;
	}
	
	this.setUnit = function(unit) 
	{ 
		//Will return if unit object is just a copy.
		if (unit === null || unit.setHex == undefined)
			return;
		unit.setHex(this);
		if (GameRules.isAir(unit))
			this.airunit = unit;
		else
			this.unit = unit;
	}
	
	this.delUnit = function(unit) 
	{
		if (unit === null || unit.setHex == undefined)
			return;
		unit.setHex(null);
		//TODO revise this. check units id ?
		if (GameRules.isAir(unit))
			this.airunit = null;
		else
			this.unit = null;
	}
	
	//Returns the unit from this hex that can be attacked by atkunit
	this.getAttackableUnit = function (atkunit, airMode)
	{
		if (GameRules.canAttack(atkunit, this.airunit) 
			&& GameRules.canAttack(atkunit, this.unit))
		{
			if (airMode)
				return this.airunit;
			else
				return this.unit;
		}	
	
		if (GameRules.canAttack(atkunit, this.unit))
			return this.unit;

		if (GameRules.canAttack(atkunit, this.airunit))
			return this.airunit;
	
		return null;
	}

	this.log = function() { console.log(this); }
	
	//private
	var r = row;
	var c = col;
};

function Map()
{
	this.rows = 0;
	this.cols = 0;
	this.map = null;
	this.name = null;
	this.description = null; 
	this.terrainImage = null;
	this.turn = 0;
	this.currentUnit = null;
	this.sidesVictoryHexes = [0, 0]; //Victory hexes for each side 
	this.currentSide = 0; //Which side is playing currently
	
	var unitImagesList = {}; //a "hash" of unique unit images used for caching
	var moveSelected = []; //selected hexes for current unit move destinations
	var attackSelected = []; //selected hexes for current unit attack destinations
	var unitList = []; //internal list of units
	var playerList = []; //players list
	var uniqueID = 0; //gets assigned as unique unit ID and incremented after each unit is added
	
	this.allocMap = function()
	{
		this.map = new Array(this.rows);
		for(var i = 0; i < this.rows; i++)
		{
			this.map[i] = new Array(this.cols);
			for(var j = 0; j < this.cols; j++)
			{
				this.map[i][j] = new Hex(i, j);
			}
		}
	}
	
	this.addUnit = function(unit) 
	{
		//Assign an unique id to the unit
		unit.id = uniqueID;
		uniqueID++;
		
		unitList.push(unit); 
		unitImagesList[unit.eqid] = unit.getIcon();
		
		if (unit.transport !== null)
			unitImagesList[unit.transport.eqid] = unit.transport.icon;
		
		//Sets the player struct
		unit.player = this.getPlayer(unit.owner);
	}
	
	this.getUnits = function() { return unitList; }
	this.getUnitImagesList = function() { return unitImagesList; }
	this.addPlayer = function(player) { playerList.push(player); }
	this.getPlayers = function() { return playerList; }
	this.getPlayer = function(id) 
	{ 
		if (id < playerList.length)
			return playerList[id]; 
		else
			return playerList[0]; //TODO parse supporting countries from the scenario file
	}
	
	this.getCountries = function()
	{
		var c = [];
		p = this.getPlayers();
		for (var i = 0; i < p.length; i++)
			c.push(p[i].country);
		return c;
	}
	
	this.setCurrentUnit = function(unit)
	{
		this.currentUnit = unit;
	}
	
	this.delCurrentUnit = function()
	{
		this.currentUnit = null;
		this.delMoveSel();
		this.delAttackSel();
	}
	
	this.delMoveSel = function()
	{
		for (var i = 0; i < moveSelected.length; i++)
		{
			var c = moveSelected[i];
			this.map[c.row][c.col].isMoveSel = false;
		}
		moveSelected = [];
	}
	
	this.delAttackSel = function()
	{
		for (var i = 0; i < attackSelected.length; i++)
		{
			var c = attackSelected[i];
			this.map[c.row][c.col].isAttackSel = false;
		}
		attackSelected = [];
	}
	
	this.setHex = function(row, col, hex)
	{
		this.map[row][col].copy(hex); //copy values
		//Increment victorySides for each side
		if (hex.victorySide != -1) 
			this.sidesVictoryHexes[hex.victorySide]++; 
		if (hex.unit !== null) 
			this.addUnit(hex.unit);
		if (hex.airunit !== null)
			this.addUnit(hex.airunit);
	}

	//Simple increment/decrement
	this.updateVictorySides = function(side, enemySide)
	{
		//A side has ocuppied a victory hex that was marked as victory for it
		this.sidesVictoryHexes[side]--;
		this.sidesVictoryHexes[enemySide]++;
		console.log("Updated side victory hexes Side: " + side + " : " 
					+ this.sidesVictoryHexes[side] + " Side: " + enemySide 
					+ " : " + this.sidesVictoryHexes[enemySide]);
		
		if (this.sidesVictoryHexes[side] <= 0) 
		{ 
			console.log("Side: " + side + " WINS !");
			return true;
		}
		return false;
	}
	
	this.setMoveRange = function(unit)
	{
		this.delMoveSel();
		
		var p = unit.getPos();
		var c = GameRules.getMoveRange(this.map, unit, p.row, p.col, this.rows, this.cols);
		
		for (var i = 0; i < c.length; i++)
		{
			moveSelected.push(c[i]);
			this.map[c[i].row][c[i].col].isMoveSel = true; 
		}
	}
	
	this.setAttackRange = function(unit)
	{
		this.delAttackSel();
		
		var p = unit.getPos();
		var c = GameRules.getAttackRange(this.map, unit, p.row, p.col, this.rows, this.cols);
		
		for (var i = 0; i < c.length; i++)
		{
			attackSelected.push(c[i]);
			this.map[c[i].row][c[i].col].isAttackSel = true; 
		}
	}
	
	this.endTurn = function()
	{
			//TODO create a Game Class
			this.delMoveSel();
			this.delAttackSel();
			this.delCurrentUnit();
			var p = this.getPlayers();
			for (var i = 0; i < p.length; i++)
			{	
				if (p[i].side == this.currentSide)
					p[i].playedTurn = this.turn;
			}
			this.currentSide = ~this.currentSide & 1;
			console.log("Side: " + this.currentSide);
			if (this.currentSide == 0)
			{
				this.turn++;
				resetUnits();
			}
	}
	
	//atkunit from srow, scol attacks defunit from drow, dcol
	this.attackUnit = function(atkunit, defunit, supportFire)
	{
		if (atkunit === null || defunit === null)
			return null;
		
		var a = atkunit.getPos();
		var d = defunit.getPos();
		var update = false; //Don't update unit list if not necessary
		var cr = GameRules.calculateAttackResults(this.map, atkunit, defunit);
		
		console.log(a.row + "," + a.col + " attacking: " + d.row + "," +d.col);
		
		atkunit.facing = GameRules.getDirection(a.row, a.col, d.row, d.col);
		defunit.facing = GameRules.getDirection(d.row, d.col, a.row, a.col);
		
		//TODO do this better
		if (!supportFire) atkunit.fire(true);
		else atkunit.fire(false);
		
		defunit.hit(cr.kills);
		
		if (cr.defcanfire && !supportFire) 
		{
			defunit.fire(false);
			atkunit.hit(cr.losses);
		}
		
		if (atkunit.destroyed) 
		{
			this.map[a.row][a.col].delUnit(atkunit);
			update = true;
		}
			
		if (defunit.destroyed)
		{
			this.map[d.row][d.col].delUnit(defunit);
			update = true;
		}	
		
		if (update) updateUnitList();
		
		if (!supportFire) this.delAttackSel();
		
		return cr;
	}
	
	// moves a unit to a new hex returns side number if the move results in a win 
	// -1 otherwise
	this.moveUnit = function(unit, drow, dcol)
	{
		var s = unit.getPos();
		var srcHex = this.map[s.row][s.col];
		var dstHex = this.map[drow][dcol];
		var player = unit.player;
		var side = player.side;
		var win = -1;
		if (dstHex.flag != -1) { dstHex.flag = player.country; }
		
		//Is a victory marked hex ?
		if (dstHex.victorySide != -1)
		{
			var enemyside = this.getPlayer(dstHex.owner).side;
			if (this.updateVictorySides(side, enemyside))
				win = side;
		}
		unit.move(GameRules.distance(s.row, s.col, drow, dcol));
		srcHex.delUnit(unit);
		dstHex.setUnit(unit);
		dstHex.owner = unit.owner;
		unit.facing = GameRules.getDirection(s.row, s.col, drow, dcol);
		
		GameRules.getShortestPath(new Cell(s.row, s.col), new Cell(drow, dcol), moveSelected);
		
		this.delMoveSel();
		this.setAttackRange(unit) //Put new attack range
		
		
		
		return win;
	}
	
	this.resupplyUnit = function(unit)
	{
		var s = GameRules.getResupplyValue(this.map, unit);
		unit.resupply(s.ammo, s.fuel);
		this.delAttackSel();
		this.delMoveSel();
	}
	
	this.reinforceUnit = function(unit)
	{
		var str = GameRules.getReinforceValue(this.map, unit);
		unit.reinforce(str);
		this.delAttackSel();
		this.delMoveSel();
	}
	
	this.mountUnit = function(unit)
	{
		unit.mount();
		this.delMoveSel();
		this.delAttackSel();
		this.selectUnit(unit); //Select the unit again to have the move range adjusted
	}
	
	this.unmountUnit = function(unit)
	{
		this.delMoveSel();
		this.delAttackSel();
		unit.unmount();
		this.selectUnit(unit); //Select the unit again to have the move range adjusted
	}
	
	this.upgradeUnit = function(id, eqid)
	{
		if ((unit = findUnitById(id)) == null)
			return;
			
		unit.eqid = eqid;
		unitImagesList[unit.eqid] = unit.getIcon();
	}
	
	// selects a new unit as the current unit
	this.selectUnit = function(unit)
	{
		if (unit === null)
			return false;
		
		//Can't select units from oposing side
		if (unit.player.side != this.currentSide)
			return false;
			
		this.delCurrentUnit();
		this.delMoveSel();
		this.delAttackSel();
		this.setCurrentUnit(unit);
				
		if (!unit.hasMoved) 
			this.setMoveRange(unit); 
		if (!unit.hasFired) 
			this.setAttackRange(unit); 
		
		return true;
	}	
	
	//Clone object / "copy constructor"
	this.copy = function(m)
	{
		if (m === null) return;
		this.rows = m.rows;
		this.cols = m.cols;
		this.description = m.description;
		this.terrainImage = m.terrainImage;
		this.name = m.name;
		this.turn = m.turn;
	
		this.allocMap();
	
		for (r = 0; r < m.rows; r++)
		{
			for (c = 0; c < m.cols; c++)
			{
				var h = m.map[r][c];
				var hex = new Hex(r, c);
				hex.copy(h);
				
				if (h.unit !== null) 
				{
					var u = new Unit(h.unit.eqid);
					u.copy(h.unit);		
					hex.setUnit(u);
				}
				if (h.airunit !== null) 
				{
					var u = new Unit(h.airunit.eqid);
					u.copy(h.airunit);		
					hex.setUnit(u);
				}
				this.setHex(r, c, hex);
			}
		}
		//update sideVictoryHexes with in progress values after setHex 
		//calls setup the default map victory hex values
		for (var i = 0; i < m.sidesVictoryHexes.length; i++)
			this.sidesVictoryHexes[i] = m.sidesVictoryHexes[i];
	}

	this.dumpMap = function()
	{
		/*
		var line = "\t ";
		var n = 0
		for(var h = 0; h < this.cols; h++)
		{
			if (h % 10 == 0) { n = 0; }
			
			line = line + " " + n + " ";
			n++;
		}
		console.log(line);
		for(var i = 0; i < this.rows; i++)
		{
			
			line = i + ":\t";
			for(var j = 0; j < this.cols; j++)
			{
				if (this.map[i][j] != null)
				{
					if (this.map[i][j].unit != null) { line += "  1"; } 
					else { line +="  0"; }	
				}
			}
			console.log(line);
		}
		*/
		for (var i = 0; i < playerList.length; i++)
		{
			console.log("Player: " + playerList[i].id + " Side:" + playerList[i].side 
						+ " Country: " + playerList[i].getCountryName());
		}
		
		console.log("Victory Hexes for Side 0: " +  this.sidesVictoryHexes[0] 
					+ " Victory Hexes for Side 1: " + this.sidesVictoryHexes[1]);
		/*
		for (var i = 0; i < unitImagesList.length; i++)
		{
			console.log(unitImagesList[i]);
		
		}
		for (var i = 0; i < unitList.length; i++)
		{
			console.log(unitList[i]);
		
		}
		*/
	}
	
	//Private

	//TODO UnitManager object
	function findUnitById(id)
	{
		for (var i = 0; i < unitList.length; i++)
		{
			if (unitList[i] !== null && unitList[i].id == id) 
				return unitList[i];
		}
		return null;
	}
	//Checks for destroyed units and remove them from list
	function updateUnitList()
	{
		for (var i = 0; i < unitList.length; i++)
		{
			if (unitList[i] !== null && unitList[i].destroyed)
				unitList.splice(i, 1);
		}
	}
	//Resets hasFired, hasMoved, hasRessuplied 
	function resetUnits()
	{
		for (var i = 0; i < unitList.length; i++)
		{
			if (unitList[i] !== null) 
				unitList[i].resetUnit();
		}
	}
	
} // end Map class
