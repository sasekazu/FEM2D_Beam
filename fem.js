// JavaScript Document
/// <reference path="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js" />
/// <reference path="numeric-1.2.6.min.js" />


function FEM(){
	this.pos = [];
	this.initpos = [];
	this.ele = [];
	this.initposcg = [];
	this.poscg = [];

	this.K = [];
	this.bcFlag = [];	// 境界条件　0:外力既知 1:変位既知
	this.u = [];
	this.f = [];
	this.ud = [];
	this.ff = [];
}


// 線分要素の作成
FEM.prototype.lineMesh = function (xstart, xend, div, divcg) {
	var dx = (xend-xstart)/div;
	this.pos = [];
	this.initpos = [];
	this.ele = [];

	// pos, initpos の作成
	for(var i=0; i<div+1; i++) 
		this.initpos.push([xstart+dx*i, 0]);
	this.pos = numeric.clone(this.initpos);

	// eleの作成
	for(var i=0; i<div; i++) {
		this.ele.push([i, i+1]);
	}

	// uの作成
	this.u = numeric.linspace(0, 0, 2*this.pos.length);

	// poscg, initposcgの作成
	var tmp = [];
	var dxcg = dx/divcg;
	var x0;
	for(var i=0; i<this.ele.length; i++) {
		tmp = [];
		x0 = this.initpos[this.ele[i][0]][0];
		for(var j=0; j<divcg+1; j++) {
			tmp.push([x0+dxcg*j, 0]);
		}
		this.initposcg.push(tmp);
	}
	this.poscg = numeric.clone(this.initposcg);

	// 剛性マトリクスの作成
	this.K = numeric.rep([2*this.pos.length,2*this.pos.length],0);
	var Ke = numeric.rep([4,4],0);;
	var len;
	var E = 1;
	var I = 1;
	for(var i=0; i<this.ele.length; i++) {
		len = this.initpos[this.ele[i][1]][0] - this.initpos[this.ele[i][0]][0];
		Ke[0][0] = 12;
		Ke[0][1] = 6*len;
		Ke[0][2] = -12;
		Ke[0][3] = 6*len;
		Ke[1][1] = 4*len*len;
		Ke[1][2] = -6*len;
		Ke[1][3] = 2*len*len;
		Ke[2][2] = 12;
		Ke[2][3] = -6*len;
		Ke[3][3] = 4*len*len;
		Ke[1][0] = Ke[0][1]; Ke[2][0] = Ke[0][2]; Ke[2][1] = Ke[1][2];
		Ke[3][0] = Ke[0][3]; Ke[3][1] = Ke[1][3]; Ke[3][2] = Ke[2][3];
		Ke = numeric.mul(E*I/(len*len*len), Ke);
		// 全体剛性マトリクスの作成
		for(var j=0; j<2; j++)
			for(var k=0; k<2; k++)
				for(var l=0; l<2; l++)
					for(var m=0; m<2; m++)
						this.K[2*this.ele[i][j]+l][2*this.ele[i][k]+m] += Ke[2*j+l][2*k+m];

	}
}

// 境界条件の設定
FEM.prototype.setBoudary=function (mousePos) {
	
	this.u = numeric.linspace(0, 0, 2*this.pos.length);
	this.ud = [];
	this.ff = [];

	this.bcFlag = [];
	for(var i=0; i<this.pos.length; i++) {
		if(i==0 ){
			this.u[2*i] = 0;
			this.bcFlag.push(1);
			this.bcFlag.push(0);
			this.ud.push(this.u[2*i]);
			this.ff.push(0);
		}else if(i==5) {
			this.u[2*i] = 0;
			this.bcFlag.push(1);
			this.bcFlag.push(0);
			this.ud.push(this.u[2*i]);
			this.ff.push(0);
		}else if(i==this.pos.length-1) {
			this.u[2*i] = mousePos[1];
			this.bcFlag.push(1);
			this.bcFlag.push(0);
			this.ud.push(this.u[2*i]);
			this.ff.push(0);
		} else {
			this.bcFlag.push(0);
			this.bcFlag.push(0);
			this.ff.push(0);
			this.ff.push(0);
		}
	}
}

// 変形計算
FEM.prototype.calcDeformation = function(){

	var flist = [];
	var dlist = [];
	for(var i=0; i<this.pos.length*2; i++) {
		if(this.bcFlag[i]==0)
			flist.push(i);
		else
			dlist.push(i);
	}
	var f = flist.length;
	var d = dlist.length;

	var Kff = numeric.rep([f,f],0);
	for(var i=0; i<f; i++)
		for(var j=0; j<f; j++)
			Kff[i][j] = this.K[flist[i]][flist[j]];

	var Kfd = numeric.rep([f,d],0);
	for(var i=0; i<f; i++)
		for(var j=0; j<d; j++)
			Kfd[i][j] = this.K[flist[i]][dlist[j]];

	var y = numeric.dot(Kfd,this.ud);
	y = numeric.neg(y);
	uf = numeric.solve(Kff,y);


	for(var i=0; i<f; i++) 
		this.u[flist[i]]=uf[i];
        
	// posの更新
	for(var i=0; i<this.pos.length; i++){
		this.pos[i][1] = this.u[2*i];
	}

	// poscgの更新
	var de = [];
	var N = [];
	var xsi;
	var divcg = this.poscg[0].length-1;
	var dxsi = 2.0/divcg;
	var len;
	for(var i=0; i<this.ele.length; i++) {

		de[0] = this.u[2*this.ele[i][0]];
		de[1] = this.u[2*this.ele[i][0]+1];
		de[2] = this.u[2*this.ele[i][1]];
		de[3] = this.u[2*this.ele[i][1]+1];
		len = this.initpos[this.ele[i][1]][0] - this.initpos[this.ele[i][0]][0];
		for(var j=0; j<divcg+1; j++) {
			xsi = dxsi*j - 1;
			N[0] = 0.25 * (1-xsi) * (1-xsi) * (2+xsi);
			N[1] = len * 0.125 * (1-xsi) * (1-xsi) * (1+xsi);
			N[2] = 0.25 * (1+xsi) * (1+xsi) * (2-xsi);
			N[3] = len * 0.125 * (1+xsi) * (1+xsi) * (xsi-1);
			this.poscg[i][j][1] = numeric.dot(N,de);
		}
	}
}