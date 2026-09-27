// Small Canvas2D transform recorder. The tests run the actual production draw methods.
export class RecordingContext {
  matrix = [1, 0, 0, 1, 0, 0];
  stack = [];
  records = [];
  canvas = { width: 1280, height: 720 };
  point(x, y) {
    const [a,b,c,d,e,f] = this.matrix;
    return { x: a*x+c*y+e, y: b*x+d*y+f };
  }
  save() { this.stack.push([...this.matrix]); }
  restore() { this.matrix = this.stack.pop(); }
  getTransform() { return [...this.matrix]; }
  setTransform(matrix) { this.matrix = [...matrix]; }
  translate(x,y) { const p = this.point(x,y); this.matrix[4]=p.x; this.matrix[5]=p.y; }
  scale(x,y) { this.matrix[0]*=x; this.matrix[1]*=x; this.matrix[2]*=y; this.matrix[3]*=y; }
  rotate(angle) {
    const [a,b,c,d,e,f]=this.matrix, s=Math.sin(angle), co=Math.cos(angle);
    this.matrix=[a*co+c*s,b*co+d*s,c*co-a*s,d*co-b*s,e,f];
  }
  fillRect(x,y,w,h) { this.records.push({kind:'box', points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>this.point(...p))}); }
  strokeRect() {}
  beginPath() { this.path=[]; }
  moveTo(x,y) { this.path.push(this.point(x,y)); }
  lineTo(x,y) { this.path.push(this.point(x,y)); }
  stroke() { if(this.path?.length) this.records.push({kind:'polyline', points:this.path}); }
  fill() {}
  arc(x,y,r) { this.records.push({kind:'circle',center:this.point(x,y),radius:r*Math.hypot(this.matrix[0],this.matrix[1])}); }
  drawImage(image,x,y,w,h) { this.records.push({kind:'image',center:this.point(x+w/2,y+h/2),width:w*Math.hypot(this.matrix[0],this.matrix[1]),height:h*Math.hypot(this.matrix[2],this.matrix[3])}); }
  strokeText() {}
  fillText() {}
}
