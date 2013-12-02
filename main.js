// JavaScript Document
/// <reference path="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js" />
/// <reference path="numeric-1.2.6.min.js" />
/// <reference path="fem.js" />

$(document).ready(function() {

	// 2dコンテキスト取得
	var canvas = $("#model_viewer");
	var context = canvas.get(0).getContext("2d");
	canvas.get(0).width = canvas.get(0).clientWidth;
	canvas.get(0).height = canvas.get(0).clientHeight;
	var canvasWidth = canvas.get(0).width;
	var canvasHeight = canvas.get(0).height;
	
	// 座標系の変換
	var xzero = canvasWidth * 0.5;
	var yzero = canvasHeight * 0.5;
	context.transform(1, 0, 0, -1, xzero, yzero);
	
	// マウス位置取得用変数	
	var mousePos = [0,0];	
	var mouseState = "Up";
	// mouse移動時のイベントコールバック設定
	$(window).mousedown( function(e){
		var canvasOffset = canvas.offset();
		var canvasX = Math.floor(e.pageX-canvasOffset.left);
		var canvasY = Math.floor(e.pageY-canvasOffset.top);
		if(canvasX>canvasWidth)return;
		if(canvasY>canvasHeight)return;
		mouseState = "Down";		
		mousePos = [canvasX-xzero, -canvasY+yzero];
	});	
	$(window).mousemove( function(e){
		var canvasOffset = canvas.offset();
		var canvasX = Math.floor(e.pageX-canvasOffset.left);
		var canvasY = Math.floor(e.pageY-canvasOffset.top);
		mousePos = [canvasX-xzero, -canvasY+yzero];
	});	
	$(window).mouseup( function(e){
		mouseState = "Up";
		var canvasOffset = canvas.offset();
		var canvasX = Math.floor(e.pageX-canvasOffset.left);
		var canvasY = Math.floor(e.pageY-canvasOffset.top);
		mousePos = [canvasX-xzero, -canvasY+yzero];
	});	
		
	
	// FEMインスタンス作成
	var fem = new FEM();
	fem.lineMesh(-200, 200, 8, 60);
	animate();
	
	// アニメーションループ
	function animate(){
		fem.setBoudary(mousePos);
		//fem.calcDeformation();
		fem.calcDynamicDeformation(0.01);
		drawScene();
		setTimeout(animate, 20);
	}
	
	///////////////////////////////////////////////
	// 以下は描画に関する関数
	///////////////////////////////////////////////
	
	// シーンの描画
	function drawScene(){
		// canvasのクリア
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, canvasWidth, canvasHeight);
		// 図形の描画
		context.setTransform(1, 0, 0, -1, xzero, yzero);
		// メッシュ
		var p1,p2;
		/*
		context.strokeStyle = 'rgb(0,0,0)';
		context.fillStyle = 'rgb(0,0,0)';
		for(var i=0; i<fem.ele.length; i++) {
			p1=fem.pos[fem.ele[i][0]];
			p2=fem.pos[fem.ele[i][1]];
			drawLine(p1, p2);
		}
		*/
		context.strokeStyle = 'rgb(0,0,0)';
		context.fillStyle = 'rgb(0,0,0)';
		for(var i=0; i<fem.pos.length; i++) {
			drawCircle(fem.pos[i], 3);
		}

		context.strokeStyle = 'black';
		context.fillStyle = 'black';
		for(var i=0; i<fem.ele.length; i++) {
			for(var j=0; j<fem.poscg[i].length-1; j++) {
				drawLine(fem.poscg[i][j], fem.poscg[i][j+1]);
			}
		}
	}
	
	// 線の描画
	function drawLine(p1, p2){
		context.beginPath();
		context.moveTo( p1[0], p1[1]);
		context.lineTo( p2[0], p2[1]);
		context.stroke();
	}
	
	// 円の描画
	function drawCircle(p, radius){
		context.beginPath();
		context.arc( p[0], p[1], radius, 0, 2*Math.PI, true);
		context.stroke();
		context.fill();
	}	
		
	// 三角形の描画
	function drawTri(p1, p2, p3){
		context.beginPath();
		context.moveTo( p1[0], p1[1]);
		context.lineTo( p2[0], p2[1]);
		context.lineTo( p3[0], p3[1]);
		context.closePath();
		context.stroke();
		context.fill();
	}
	
});


