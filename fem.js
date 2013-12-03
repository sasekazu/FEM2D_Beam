// JavaScript Document
/// <reference path="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js" />
/// <reference path="numeric-1.2.6.min.js" />


function FEM(){
	this.pos = [];		// 節点現在位置 n x 2
	this.initpos = [];	// 節点初期位置 n x 2
	this.th = [];		// 節点たわみ角 n x 1
	this.ele = [];		// 要素の節点リスト e x 2
	this.vel = [];		// 速度ベクトル 3n x 1
	this.initposcg = [];	// 描画用頂点初期位置 e x (divcg+1) x 2
	this.poscg=[];			// 描画用頂点現在位置 e x (divcg+1) x 2

	this.K = [];		// 全体剛性マトリクス 3n x 3n
	this.bcFlag = [];	// 境界条件フラグ　0:外力既知 1:変位既知 3n x 1
	this.u = [];		// 全体変位ベクトル 3n x 1
	this.f = [];		// 全体外力ベクトル 3n x 1
	this.ud = [];		// 変位既知部分の変位ベクトル d x 1
	this.uf = [];		// 外力既知部分の変位ベクトル f x 1
	this.udprev = [];	// 前ループのuに対応するud d x 1
	this.ff=[];			// 外力既知部分の外力ベクトル f x 1

	this.density = 0.0001;	
	this.area = 0.1;

	this.alpha = 0.1;
	this.beta = 0.0;

	this.alpha_th =0.1;
	this.beta_th = 0.0;

	this.mass = [];
	this.gravity = 0;
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
	this.th = numeric.linspace(0,0,this.pos.length);

	// eleの作成
	for(var i=0; i<div; i++) {
		this.ele.push([i, i+1]);
	}

	// uの作成
	this.u = numeric.linspace(0, 0, 3*this.pos.length);

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

	// velの作成
	this.vel = numeric.linspace(0,0,3*this.pos.length);

	// 剛性マトリクスの作成
	this.K = numeric.rep([3*this.pos.length,3*this.pos.length],0);
	var KeBend = numeric.rep([4,4],0);;
	var KeP = numeric.rep([2,2],0);
	var len;
	var E = 100;
	var I = 1;
	for(var i=0; i<this.ele.length; i++) {
		len = this.initpos[this.ele[i][1]][0] - this.initpos[this.ele[i][0]][0];

		KeP[0][0] = 1;
		KeP[0][1] = -1;
		KeP[1][0] = -1;
		KeP[1][1] = 1;
		KeP = numeric.mul(KeP, this.area*E/len);

		KeBend[0][0] = 12;
		KeBend[0][1] = 6*len;
		KeBend[0][2] = -12;
		KeBend[0][3] = 6*len;
		KeBend[1][1] = 4*len*len;
		KeBend[1][2] = -6*len;
		KeBend[1][3] = 2*len*len;
		KeBend[2][2] = 12;
		KeBend[2][3] = -6*len;
		KeBend[3][3] = 4*len*len;
		KeBend[1][0] = KeBend[0][1]; KeBend[2][0] = KeBend[0][2]; KeBend[2][1] = KeBend[1][2];
		KeBend[3][0] = KeBend[0][3]; KeBend[3][1] = KeBend[1][3]; KeBend[3][2] = KeBend[2][3];
		KeBend = numeric.mul(E*I/(len*len*len), KeBend);
		// 全体剛性マトリクスの作成
		for(var j=0; j<2; j++) {
			for(var k=0; k<2; k++) {
				this.K[3*this.ele[i][j]][3*this.ele[i][k]] += KeP[j][k];
			}
		}
		for(var j=0; j<2; j++)
			for(var k=0; k<2; k++)
				for(var l=0; l<2; l++)
					for(var m=0; m<2; m++)
						this.K[3*this.ele[i][j]+l+1][3*this.ele[i][k]+m+1] += KeBend[2*j+l][2*k+m];

	}

	// massの作成
	var len, mass_tmp;
	this.mass=numeric.linspace(0, 0, 3*this.pos.length);
	for(var i=0; i<this.ele.length; i++){
		len=this.initpos[this.ele[i][1]][0]-this.initpos[this.ele[i][0]][0];
		mass_tmp = len * this.area * this.density;
		this.mass[3*this.ele[i][0]] += mass_tmp*0.5;
		this.mass[3*this.ele[i][0]+1] += mass_tmp*0.5;
		this.mass[3*this.ele[i][0]+2] += mass_tmp*0.5;
		this.mass[3*this.ele[i][1]] += mass_tmp*0.5;
		this.mass[3*this.ele[i][1]+1] += mass_tmp*0.5;
		this.mass[3*this.ele[i][1]+2] += mass_tmp*0.5;
	}
}

// 境界条件の設定
FEM.prototype.setBoudary=function (mousePos) {
	
	var uprev = numeric.clone(this.u);
	this.u = numeric.linspace(0, 0, 3*this.pos.length);
	this.f = numeric.linspace(0, 0, 3*this.pos.length);
	this.ud = [];
	this.uf = [];
	this.ff = [];

	this.bcFlag = numeric.linspace(0,0,3*this.pos.length);
	// すべての自由度に対してu, bcFlagを設定する
	var contactNode;
	if(this.pos.length%2==0)
		contactNode = this.pos.length/2;
	else
		contactNode = (this.pos.length-1)/2;

	for(var i=0; i<this.pos.length; i++) {
		if(i==0 || i==this.pos.length-1){
//		if(i==0 || i==this.pos.length-1){
			this.u[3*i+0] = 0;
			this.u[3*i+1] = 0;
			this.bcFlag[3*i+0]=1;
			this.bcFlag[3*i+1]=1;
			this.bcFlag[3*i+2]=0;
		} else if(i==contactNode) {
			this.u[3*i+0] = mousePos[0] - this.initpos[i][0];
			this.u[3*i+1] = mousePos[1];
			this.bcFlag[3*i+0]=1;
			this.bcFlag[3*i+1]=1;
			this.bcFlag[3*i+2]=0;
		} else {
			this.f[3*i+1] = - this.mass[i] * this.gravity;
			this.bcFlag[3*i+0]=0;
			this.bcFlag[3*i+1]=0;
			this.bcFlag[3*i+2]=0;
		}
	}

	var flist = [];
	var dlist = [];
	for(var i=0; i<this.pos.length*3; i++) {
		if(this.bcFlag[i]==0)
			flist.push(i);
		else
			dlist.push(i);
	}

	for(var i=0; i<flist.length; i++) {
		this.uf[i] = this.u[flist[i]];
	}
	for(var i=0; i<flist.length; i++) {
		this.ff[i] = this.f[flist[i]];;
	}
	for(var i=0; i<dlist.length; i++) {
		this.ud[i] = this.u[dlist[i]];
	}
	for(var i=0; i<dlist.length; i++) {
		this.udprev[i] = uprev[dlist[i]];
	}

	// poscgの更新
	//this.updatePosCG();

}

// 変形計算
FEM.prototype.calcDeformation = function(){

	var flist = [];
	var dlist = [];
	for(var i=0; i<this.pos.length*3; i++) {
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
	y = numeric.sub(this.ff, y);
	uf = numeric.solve(Kff,y);


	for(var i=0; i<f; i++) 
		this.u[flist[i]]=uf[i];
        
	// posの更新
	for(var i=0; i<this.pos.length; i++){
		this.pos[i][0] = this.initpos[i][0]+this.u[3*i+0];
		this.pos[i][1] = this.initpos[i][1]+this.u[3*i+1];
	}

	// thの更新
	for(var i=0; i<this.th.length; i++) {
		this.th[i] = this.u[3*i+2];
	}

	// poscgの更新
	this.updatePosCG();
}

// 境界条件を設定して変形計算を行う
// 境界条件は y=0 を固定，ノード番号spNodeに強制変位disp[2]を与える
FEM.prototype.calcDynamicDeformation=function (dt) {

	var flist=[];
	var dlist=[];
	for(var i=0; i<this.pos.length*3; i++) {
		if(this.bcFlag[i]==0)
			flist.push(i);
		else
			dlist.push(i);
	}

	var f = flist.length;
	var d = dlist.length;
	
	var vf = numeric.linspace(0, 0, f);
	for(var i=0; i<f; i++) {
		vf[i]=this.vel[flist[i]];
	}

	var vd=numeric.linspace(0, 0, d);
	for(var i=0; i<d; i++) {
		vd[i]=(this.ud[i]-this.udprev[i])/dt;
	}

	var Kff=numeric.rep([f, f], 0);
	for(var i=0; i<f; i++)
		for(var j=0; j<f; j++)
			Kff[i][j]=this.K[flist[i]][flist[j]];

	var Kfd=numeric.rep([f, d], 0);
	for(var i=0; i<f; i++)
		for(var j=0; j<d; j++)
			Kfd[i][j]=this.K[flist[i]][dlist[j]];


	var M = numeric.identity(f);
	for(var i=0; i<f; i++) {
		if(flist[i]%3!=2)
			M[i][i] *= (1+this.alpha*dt)*this.mass[flist[i]];
		else
			M[i][i] *= (1+this.alpha_th*dt)*this.mass[flist[i]];
	}

	var Mright1=numeric.dot(M, vf);
	var Mleft2=numeric.mul(Kff, (dt*dt+dt*this.beta));
	var Mleft=numeric.add(M, Mleft2);


	var Mright2=numeric.dot(Kff, this.uf);
	var tmp=numeric.dot(Kfd, this.ud);
	Mright2=numeric.add(Mright2, tmp);
	Mright2=numeric.sub(Mright2, this.ff);
	Mright2=numeric.mul(Mright2, -dt);
	var Mright=numeric.add(Mright1, Mright2);

	vf = numeric.solve(Mleft, Mright);

	for(var i=0; i<f; i++) {
		this.vel[flist[i]] = vf[i];
	}
	for(var i=0; i<d; i++) {
		this.vel[dlist[i]]=vd[i];
	}

	var duf = numeric.mul(dt, vf);
	this.uf=numeric.add(this.uf, duf);

	for(var i=0; i<f; i++)
		this.u[flist[i]]=this.uf[i];

	// posの更新
	for(var i=0; i<this.pos.length; i++){
		this.pos[i][0] = this.initpos[i][0]+this.u[3*i+0];
		this.pos[i][1] = this.initpos[i][1]+this.u[3*i+1];
	}

	// thの更新
	for(var i=0; i<this.th.length; i++) {
		this.th[i] = this.u[3*i+2];
	}

	// poscgの更新
	this.updatePosCG();
}

FEM.prototype.modifyPosCld = function(xmin, ymin, xmax, ymax){
	for(var i=0; i<this.pos.length; i++) {
		if(this.pos[i][0]<xmin) {
			this.pos[i][0]=xmin;
			this.vel[2*i]=0;
			this.vel[2*i+1]=0;
		}
		if(this.pos[i][0]>xmax) {
			this.pos[i][0]=xmax;
			this.vel[2*i]=0;
			this.vel[2*i+1]=0;
		}
		if(this.pos[i][1]<ymin) {
			this.pos[i][1]=ymin;
			this.vel[2*i]=0;
			this.vel[2*i+1]=0;
		}
		if(this.pos[i][1]>ymax) {
			this.pos[i][1]=ymax;
			this.vel[2*i]=0;
			this.vel[2*i+1]=0;
		}
	}
}

FEM.prototype.updatePosCG = function(){
	var de=[];
	var N=[];
	var xsi;
	var divcg=this.poscg[0].length-1;
	var dxsi=2.0/divcg;
	var len;
	for(var i=0; i<this.ele.length; i++) {

		// X座標の更新
		var dx = this.pos[this.ele[i][1]][0] - this.pos[this.ele[i][0]][0];
		var dxcg = dx/divcg;
		var x0 = this.pos[this.ele[i][0]][0];
		for(var j=0; j<divcg+1; j++) {
			this.poscg[i][j][0] = x0+dxcg*j;
		}

		// Y座標の更新
		de[0]=this.u[3*this.ele[i][0]+1];
		de[1]=this.u[3*this.ele[i][0]+2];
		de[2]=this.u[3*this.ele[i][1]+1];
		de[3]=this.u[3*this.ele[i][1]+2];
		len=this.initpos[this.ele[i][1]][0]-this.initpos[this.ele[i][0]][0];
		for(var j=0; j<divcg+1; j++) {
			xsi=dxsi*j-1;
			N[0]=0.25*(1-xsi)*(1-xsi)*(2+xsi);
			N[1]=len*0.125*(1-xsi)*(1-xsi)*(1+xsi);
			N[2]=0.25*(1+xsi)*(1+xsi)*(2-xsi);
			N[3]=len*0.125*(1+xsi)*(1+xsi)*(xsi-1);
			this.poscg[i][j][1]=numeric.dot(N, de);
		}
	}
}

