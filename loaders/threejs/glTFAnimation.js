/**
 * @author Tony Parisi / http://www.tonyparisi.com/
 */

THREE.glTFAnimator = ( function () {

	var animators = [];

	return	{
		add : function(animator)
		{
			animators.push(animator);
		},

		remove: function(animator)
		{

			var i = animators.indexOf(animator);

			if ( i !== -1 ) {
				animators.splice( i, 1 );
			}
		},

		update : function()
		{
			for (i = 0; i < animators.length; i++)
			{
				animators[i].update();
			}
		},
	};
})();

// Construction/initialization
THREE.glTFAnimation = function(interps)
{
	this.running = false;
	this.loop = false;
	this.duration = 0;
	this.startTime = 0;
	this.interps = [];
	
	if (interps)
	{
		this.createInterpolators(interps);
	}
}

THREE.glTFAnimation.prototype.createInterpolators = function(interps)
{
	var i, len = interps.length;
	for (i = 0; i < len; i++)
	{
		var interp = new THREE.glTFInterpolator(interps[i]);
		this.interps.push(interp);
		this.duration = Math.max(this.duration, interp.duration);
	}
}

// Start/stop
THREE.glTFAnimation.prototype.play = function()
{
	if (this.running)
		return;
	
	this.startTime = Date.now();
	this.running = true;
	THREE.glTFAnimator.add(this);
}

THREE.glTFAnimation.prototype.stop = function()
{
	this.running = false;
	THREE.glTFAnimator.remove(this);
}

// Update - drive key frame evaluation
THREE.glTFAnimation.prototype.update = function()
{
	if (!this.running)
		return;
	
	var now = Date.now();
	var deltat = (now - this.startTime) / 1000;
	var t = deltat % this.duration;
	var nCycles = Math.floor(deltat / this.duration);
	
	if (nCycles >= 1 && !this.loop)
	{
		this.running = false;
		var i, len = this.interps.length;
		for (i = 0; i < len; i++)
		{
			this.interps[i].interp(this.duration);
		}
		THREE.glTFAnimator.remove(this);
		return;
	}
	else
	{
		var i, len = this.interps.length;
		for (i = 0; i < len; i++)
		{
			this.interps[i].interp(t);
		}
	}
}

//Interpolator class
//Construction/initialization
THREE.glTFInterpolator = function(param) 
{	    		
	this.keys = param.keys;
	this.values = param.values;
	this.count = param.count;
	this.type = param.type;
	this.path = param.path;
	
	var node = param.target;
	switch (param.path) {
		case "translation" :
			this.target = node.position;
			this.nComponents = 3;
			break;
		case "rotation" :
			this.target = node.rotation;
			this.nComponents = 4;
			this.quaternion = new THREE.Quaternion;
			break;
		case "scale" :
			this.target = node.scale;
			this.nComponents = 3;
			break;
	}
	
	this.duration = this.keys[this.count - 1];
	
	this.tmp1 = new Array(this.nComponents);
	this.tmp2 = new Array(this.nComponents);
	this.tmp3 = new Array(this.nComponents);
}

//Interpolation and tweening methods
THREE.glTFInterpolator.prototype.interp = function(t)
{
	var i, j;
	if (t == this.keys[0])
	{
		for (i = 0; i < this.nComponents; i++)
		{
			this.tmp1[i] = this.values[i];
		}
	}
	else if (t >= this.keys[this.count - 1])
	{
		for (i = 0; i < this.nComponents; i++)
		{
			this.tmp1[i] = this.values[(this.count - 1) * this.nComponents + i];
		}
	}
	else
	{
		for (i = 0; i < this.count - 1; i++)
		{
			var key1 = this.keys[i];
			var key2 = this.keys[i + 1];
	
			if (t >= key1 && t <= key2)
			{
				for (j = 0; j < this.nComponents; j++)
				{
					this.tmp1[j] = this.values[i * this.nComponents + j];
					this.tmp2[j] = this.values[(i + 1) * this.nComponents + j];
				}

				this.tween(this.tmp1, this.tmp2, this.tmp3, (t - key1) / (key2 - key1));
			}
		}
	}
	
	if (this.target)
	{
		this.copyValue(this.tmp3, this.target);
	}
}

THREE.glTFInterpolator.prototype.tween = function(from, to, out, fract) {
	var i;
	for (i = 0; i < this.nComponents; i++) {
		var range = to[i] - from[i];
		var delta = range * fract;
		out[ i ] = from[ i ] + delta;
	}
}

THREE.glTFInterpolator.prototype.copyValue = function(from, target) {
	
	switch (this.path) {
	
		case "translation" :
			target.set(from[0], from[1], from[2]);
			break;
		case "rotation" :
			this.quaternion.set(from[0], from[1], from[2], from[3])
			target.setEulerFromQuaternion(this.quaternion);
			break;
		case "scale" :
			target.set(from[0], from[1], from[2]);
			break;
	}
}
