/** Generation checks prevent slow obsolete replies from changing the visible folder. */
export class DirectoryBrowser {
  #generation=0;
  constructor({list,parent,start,onChange=() => {}}) {this.list=list;this.parentPath=parent;this.state={path:start,entries:[],status:'idle',error:''};this.history=[start];this.index=0;this.onChange=onChange;}
  async navigate(path,{history=true}={}) {
    const generation=++this.#generation; this.state={...this.state,status:'loading',error:''}; this.onChange(this.state);
    try {
      const result=await this.list(path);
      if (generation !== this.#generation) return;
      if (history && this.state.path !== result.path) {this.history=this.history.slice(0,this.index+1);this.history.push(result.path);this.index=this.history.length-1;}
      this.state={path:result.path,entries:result.entries,status:'ready',error:''}; this.onChange(this.state);
    } catch(error) {if (generation !== this.#generation) return;
      const message=['EACCES','EPERM',3].includes(error.code) ? 'Keine Berechtigung für diesen Ordner.':['ENOENT',2].includes(error.code) ? 'Ordner nicht gefunden.':error.code === 'NOT_CONNECTED' ? 'Nicht verbunden.':'Ordner konnte nicht gelesen werden.';
      this.state={...this.state,status:'error',error:message}; this.onChange(this.state);
    }
  }
  refresh() {return this.navigate(this.state.path,{history:false});}
  up() {return this.navigate(this.parentPath(this.state.path));}
  async back() {if (this.index > 0) {const previous=this.index;this.index--; await this.navigate(this.history[this.index],{history:false});if (this.state.status === 'error') this.index=previous;}}
  async forward() {if (this.index+1 < this.history.length) {const previous=this.index;this.index++;await this.navigate(this.history[this.index],{history:false});if (this.state.status === 'error') this.index=previous;}}
  invalidate() {this.#generation++;this.state={...this.state,entries:[],status:'disconnected',error:''};this.onChange(this.state);}
}
