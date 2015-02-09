//'Displacement' by Gary Zhang
//I have no idea why I decided on this name when I first made this code.

var Displacement=new function(){

  //shared resources
  var html=document.getElementsByTagName("html")[0];

  lal=numeric;
  
  var I3=lal.identity(3);
  var I2=lal.identity(2);
  
  var dRequestAnimationFrame = window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame;

  //these tags should not contain elements within them
  var voidTags=("area, base, br, col, command, embed, hr, input, keygen, link, meta, param, source, track, wbr, svg, iframe").split(", ");
  this.isVoidTag=function(tag){
    tag=tag.toLowerCase();
    var voidTag;
    for (i in voidTags){
      if (tag==voidTags[i])
        return true;
    }
    return false
  }
  
  //checks if element has a certain class
  function chkClass(element, elementClass){
    return element.className&&new RegExp("(?:^|\\s)"+elementClass+"(\\s|$)").test(element.className);
  }
  
  //removes class from element
  function remClass(element, elementClass){
    element.className=element.className.replace(new RegExp("(?:^|\\s)"+elementClass+"(?!\\S)","g"),"");
  }
  
  //convert number to string without scientific notation
  function noExponent(n){
    var s;
	var ZeroPad = "000000000000000000000000000000000000000000000000000000000000" + 
	"000000000000000000000000000000000000000000000000000000000000" +
	"000000000000000000000000000000000000000000000000000000000000" +
	"000000000000000000000000000000000000000000000000000000000000" +
	"000000000000000000000000000000000000000000000000000000000000" +
	"000000000000000000000000000000000000000000000000000000000000";
    if (n<0){s="-";}else{s="";}
    if (Math.abs(n)<1){
      var e=parseInt(n.toString().split("e-")[1]);
      if (e) {
        if (e>309) {
          n=n*Math.pow(10,300)*Math.pow(10,e-301);
        } else {
          n*=Math.pow(10,e-1);
        }
        n=s+"0."+ZeroPad.substr(0,e-1)+n.toString().replace("-","").replace(".","").split("e")[0];
      }
    }else{
      var e=parseInt(n.toString().split('e+')[1]);
      if (e>20){
          e-=20;
          n/=Math.pow(10,e);
          n+=ZeroPad.substr(0,e+1);
      }
    }
    return n;
  }
  
  //attempts to turn the string value for CSS transforms into a matrix
  function parseTransform(transform){
    if (!transform) return undefined;
    if (transform=="none") return [lal.clone(I3),"none"];
    var matrix=[];
    if (transform.match(/matrix3d/)){
      transform=transform.replace("matrix3d(","").replace(")","").split(",");
      for (i in transform){
        transform[i]=Number(transform[i]);
      }
      matrix[0]=[transform[5],transform[1],transform[8],transform[13]];
      matrix[1]=[transform[4],transform[0],transform[9],transform[12]];
      matrix[2]=[transform[6],transform[2],transform[10],transform[14]];
      matrix[3]=[transform[7],transform[3],transform[11],transform[15]];
      return [matrix,"3D"];
    }
    if (transform.match(/matrix/)&&!transform.match(/3d/)){
      transform=transform.replace("matrix(","").replace(")","").split(",");
      for (i in transform){
        transform[i]=Number(transform[i]);
      }
      matrix[0]=[transform[3],transform[1],transform[5]];
      matrix[1]=[transform[2],transform[0],transform[4]];
      matrix[2]=[0,0,1];
      return [matrix,"2D"];
    }
    return [undefined,undefined];
  }
  
  //converts a matrix into a CSS 2D matrix transform string
  function toTransform(matrix){ //numeric.js has a pointwise function creator, but there is no documentation on it at all.
    return ("matrix("+
      noExponent(matrix[1][1])+","+
      noExponent(matrix[0][1])+","+
      noExponent(matrix[1][0])+","+
      noExponent(matrix[0][0])+","+
      noExponent(matrix[1][2])+","+
      noExponent(matrix[0][2])+")");
  }
  
  //makes a rotation transform matrix from an angle
  function toRotationMatrix(angle){
    return [[Math.cos(angle),Math.sin(angle)],[-Math.sin(angle),Math.cos(angle)]];
  }

  //the opposite of above, using the first vector of the matrix
  function fromRotationMatrix(matrix){
    return Math.acos(matrix[0][0])*sgn(Math.asin(matrix[0][1]));
  }
  
  //yes
  function pythag(a,b){
    return Math.sqrt(a*a+b*b);
  }
  
  //equivalence function but allowing for a certain tolerance
  function eqv(a,b,tol){
    tol=(typeof tol==="undefined")?Number("1e-7"):tol;
    return Math.abs(a-b)<=tol;
  }
  
  //why isn't this built in....
  function sgn(n){
    return n?n<0?-1:1:0;
  }

  //interface functions
  this.transformInitialize = function(initialFrame) {
    return page.initialize(initialFrame);
  };
  this.navigateInitialize = function() {
    return nav.initialize();
  };
  this.setHomeHash = function(homeHash) {
    nav.homeHash = homeHash;
  };
  this.setAnimateTime = function(time) {
    nav.doAnimate = time;
  };
  this.setAnimateTimingFunction = function(timingFunction) {
    nav.animateTiming = timingFunction;
  };
  this.allowScrolling = function(bool) {
    nav.doScroll = bool;
  };
  this.useParallaxDependentScrolling = function(bool) {
    nav.doParallaxScroll = bool;
  };
  this.allowDragging = function(bool) {
    nav.doDrag = bool;
  };
  this.useParallaxDependentDragging = function(bool) {
    nav.doParallaxDrag = bool;
  };
  this.useSnapping = function(bool) {
    nav.doSnap = bool;
  };
  this.getElementList = function() {
    return elementList;
  }
  this.getSnapTo = function(point) {
    return nav.getSnapTo(point);
  };
  
  //the meat of the entire script; it manages the entire webpage
  var page=new function(){
    //position of window relative to webpage
    var windowFrame=lal.clone(I3);
    
    //an offset applied with windowFrame so that objects are centered... at the center of the window
    var windowOffset=lal.clone(I3);
    this.windowOffsetFactor=0.5;
    
    //a event to be fired when the webpage moves; implementation is disabled
    var translateEvent;
    
    //list of the custom data attribute (data-Displacement) properties that can be specified on the html elements
    var dataProperties=["doPosition","focus","limit","parallax","parallaxOrigin"];
    
    //the size of the window containing the webpage
    this.windowSize=[0,0];
    
    //the navigable limits of the entire webpage, as a rectangle
    this.scrollableArea=lal.clone(I2);
    this.extents=[0,0];
    
    //whether the script has been activated or not
    var m_initialized=false;
    
    //activate the script, takes an argument that specifies where the window should be positioned in the website
    this.initialize=function(initialFrame){
      if (m_initialized) { return; }
      initialFrame=(typeof initialFrame==="undefined")?lal.clone(I3):initialFrame;
      
      //create translateEvent
      /*if (document.createEventObject){
        translateEvent=document.createEvent("Event");
        //if (event.initEvent) event.initEvent("translate",true,true);
        if (event.initCustomEvent) event.initEvent("translate",true,true);
      }else if (CustomEvent){
        translateEvent=new CustomEvent("translate");
      }*/
      
      initialLayout(initialFrame);
      
      //window resize event
      if (window.addEventListener){
        window.addEventListener("resize",resize,true);
      }else if (window.attachEvent){
        window.attachEvent('resize',resize);
      }
      
      //todo: add dom mutation observer?
      //currently, 
      m_initialized=true;
    };
    
    this.initialized=function(){ return m_initialized; };
    
    //window resize event callback; recalculate window size-dependent metrics, then reposition the elements
    function resize(){sizeWindow(); translateElements(windowFrame);};
    
    //calculate window size-dependent metrics
    function sizeWindow(){
      page.windowSize=[window.innerHeight,window.innerWidth];
      var bodyObj=elementList.fetch(document.body);
      var halfDiagonal=pythag(page.windowSize[0],page.windowSize[1])/2;
      
      //if scrollableArea should be any different from extents due to window size, this is where the difference is added
      page.scrollableArea=[
        [page.extents[0][0],page.extents[0][1]],
        [page.extents[1][0],page.extents[1][1]]];
        
      //recenter the window
      windowOffset=[[1,0,page.windowSize[0]*page.windowOffsetFactor],[0,1,page.windowSize[1]*page.windowOffsetFactor],[0,0,1]];
      return;
    }
    
    //call read all the elements and calculates their relative position, then position the window to the initial position and position the elements correctly.
    function initialLayout(initialFrame){
      //the function that reads all the html and gets all the positions
      setLayout(document.body,true);
      
      sizeWindow();
      updateGlobalPositions(elementList.fetch(document.body));
      page.extents=page.getExtents();
      sizeWindow(); //why do I also call this 2 lines ago; I'll have to figure out later
      translateElements(initialFrame,true); //arrange all the elements for the initial window position
      windowFrame=initialFrame; //current window position to the current window position
    }
    
    //this function nudges the window from its current position by the specified offset (relative to the window) and rotates it by the amount of rotation
    this.shift=function(offset,rotation){
      offset=(typeof offset==="undefined")?[0,0]:offset;
      offset=lal.dot(lal.getBlock(windowFrame,[0,0],[1,1]),offset);
      page.move(offset,rotation);
    }
    
    //this function nudges the window from its current position by the specified offset (relative to the page) and rotates it by the amount of rotation
    this.move=function(offset,rotation){
      offset=(typeof offset==="undefined")?[0,0]:offset;
      rotation=(typeof rotation==="undefined")?0:rotation;
      if (typeof rotation=="number"){
        rotation=toRotationMatrix(rotation);
      }
      var windowRotation=[[windowFrame[0][0],windowFrame[0][1]],[windowFrame[1][0],windowFrame[1][1]]];
      windowRotation=lal.dot(rotation,windowRotation);
      var windowTranslation=[windowFrame[0][2]+offset[0],windowFrame[1][2]+offset[1]];
      page.goTo([
        [windowRotation[0][0],windowRotation[0][1],windowTranslation[0]],
        [windowRotation[1][0],windowRotation[1][1],windowTranslation[1]],
        [0,0,1],
      ]);
    };
    
    //sets the window rotation using an angle in radians or a rotation matrix
    this.rotateTo=function(rotation){
      rotation=(typeof rotation==="undefined")?0:rotation;
      if (typeof rotation=="number"){
        rotation=toRotationMatrix(rotation);
      }
      var windowTranslation=[windowFrame[0][2],windowFrame[1][2]];
      page.goTo([
        [rotation[0][0],rotation[0][1],windowTranslation[0]],
        [rotation[1][0],rotation[1][1],windowTranslation[1]],
        [0,0,1],
      ]);
    };
    
    //jumps the window to the specified coordinate frame relative to the page; prevents exceeding of scrollableArea
    this.goTo=function(frame){
      frame=lal.clone(frame);
      if (frame){
        if (frame[0][2]<page.scrollableArea[0][0]) frame[0][2]=page.scrollableArea[0][0];
        if (frame[0][2]>page.scrollableArea[1][0]) frame[0][2]=page.scrollableArea[1][0];
        if (frame[1][2]<page.scrollableArea[0][1]) frame[1][2]=page.scrollableArea[0][1];
        if (frame[1][2]>page.scrollableArea[1][1]) frame[1][2]=page.scrollableArea[1][1];
        translateElements(frame);
        windowFrame=frame;
      }
    };
    
    //accessory function in the case that something screwed up
    this.reTranslate=function(){
      sizeWindow();
      translateElements(windowFrame,true);
    };
    
    //takes a custom html data attribute and splits it according to semicolons and colons into key value pairs
    function splitData(data){
      table={};
      if (!(typeof data==="string")) return table;
      data=data.replace(/\s+/g,"").split(";");
      for (i in data){
        data[i]=data[i].split(":");
        if (data[i].length==2){
          table[data[i][0]]=data[i][1];
        }
      }
      return table;
    }
    
    //takes the key value pairs from the previous function and converts the value strings into numbers based on the key
    function parseData(data){
      if (!data) return null;
      var prop,key;
      for (i in dataProperties){
        key=dataProperties[i];
        prop=data[key];
        if (key=="focus"){
          if (prop){
            var num;
            prop=prop.split(",");
            if (prop[0]){
              num=Number(prop[0])
              if (!isNaN(num)) prop[0]=num;
            }
            num=null;
            if (prop[1]){
              num=Number(prop[1])
              if (!isNaN(num)) prop[1]=num;
            }
          }else prop=[0,0];
        }else if (key=="limit"){
          if (prop){
            prop=prop.split(",");
            for (i=0;i<4;i++){
              prop[i]=Number(prop[i]);
            }
          }else prop=[NaN,NaN,NaN,NaN];
        }else if (key=="parallax"){
          if (!prop){
            prop=lal.clone(I2);
          }else{
            if (!isNaN(Number(prop))){
              prop=Number(prop);
              prop=lal.diag([prop,prop]);
            }else{
              if (prop.match(/basis/)){
                prop=prop.replace("basis(","").replace(")","").split(",");
                for (i in prop){
                  prop[i]=Number(prop[i]);
                  if (isNaN(prop[i])){
                    prop=[1,0,0,1];
                    break;
                  }
                }
                var matrix=[];
                matrix[0]=[prop[3],prop[1]];
                matrix[1]=[prop[2],prop[0]];
                prop=lal.clone(matrix);
                if (lal.det(prop)==0||lal.eig(prop).lambda.y) //if the parallax matrix is noninvertible or has rotation (complex eigenvalues) then set to identity matrix
                  prop=lal.clone(I2);
              }else{
                prop=lal.clone(I2);
              }
            }
          }
        }else if (key=="parallaxOrigin"){
          prop=(prop==null)?"parent":prop;
          prop=prop.replace(/\s+/g,"").split(",");
          if (!(prop[0]=="parent"||prop[0]=="this")) prop[0]="parent";
          prop[1]=(isNaN(Number(prop[1])))?0:Number(prop[1]);
          prop[2]=(isNaN(Number(prop[2])))?0:Number(prop[2]);
        }else if (key=="snap"){
          prop=(typeof prop==="string")?prop:"nosnap";
        }
        data[key]=prop;
      }
      return data;
    }
    
    //get html position of element relative to its parent
    function getOffset(element){
      var offsetParent=element.offsetParent;
      var parent=element.parentNode;
      if (!offsetParent) return undefined;
      if (!parent) return undefined;
      if (parent==offsetParent){
        var style=elementList.getParent(elementList.fetch(element)).style;
        var borders={ //I may switch this to clientTop and clientLeft
          top:Number(style.borderTopWidth.replace("px","")),
          left:Number(style.borderLeftWidth.replace("px","")),
          bottom:Number(style.borderBottomWidth.replace("px","")),
          right:Number(style.borderRightWidth.replace("px",""))
        };
        return [element.offsetTop+borders["top"],element.offsetLeft+borders["left"]];
      }
      if (parent.offsetParent==offsetParent){
        return [element.offsetTop-parent.offsetTop,element.offsetLeft-parent.offsetLeft];
      }
      return undefined;
    }
    
    //rearrange elements according to the relative position of the window (the actual window is stationary and the elements are transformed around)
    function translateElements(frame,reset){
      if (!lal.det(frame)) return false;
      var bodyObj=elementList.fetch(document.body)
      var bodystyle=bodyObj.style;
      var windowRotation=lal.getBlock(frame,[0,0],[1,1]);
      var list=elementList.getList();
      var invFrame=lal.inv(frame);
      var centerMT=[
        [0,0,-bodyObj.center[0]],
        [0,0,-bodyObj.center[1]],
        [0,0,0]];
        
      //position of page relative to window; despite the variable name, the actual body element remains stationary and it is its direct children that are moved around
      var bodyRelativePosition=lal.dot(lal.inv(windowRotation),[frame[0][2],frame[1][2]]);
      bodyRelativePosition=[
        [1,0,bodyRelativePosition[0]],
        [0,1,bodyRelativePosition[1]],
        [0,0,1]];
        
      //go through ALL the elements
      for (i in list){
        if (list[i].element==document.body) continue;
        var elementObj=list[i]
        var transformed=false;
        
        //the applied transform will be the CSS transform of the element relative to its [original html position relative to its parent element]
        var appliedTransform=toTransform(elementObj.originalTransform); //some elements will have CSS transforms already, so those transforms should always be applied
        if (elementObj.doPosition!="never"){ //if the elements are allowed to be repositioned/have parallax...
          //special case for elements that are direct children of the body element; they actually need to be moved around
          //other elements only need a parallax effect
          if (elementList.getLevel(elementObj)==2){
            transformed=true;
            var centerPosition=[
              [1,0,elementObj.centerRelativeMatrix[0][2]],
              [0,1,elementObj.centerRelativeMatrix[1][2]],
              [0,0,1]];
            appliedTransform=toTransform(lal.dot(lal.add(windowOffset,centerMT),lal.dot(lal.inv(centerPosition),lal.dot(invFrame,centerPosition))))+" "+appliedTransform;
          }
          
          elementObj.relativeToWindow=lal.dot(invFrame,elementObj.effectiveGlobalFrame);
          
          //don't calculate for elements with parallax equal to unit matrix (no parallax)
          //epsilon is the difference between one and the smallest value above one in js
          var tolerantDifference=lal.abs(lal.sub(elementObj.parallax,[[1,0],[0,1]]));
          if (!lal.all(lal.lt(tolerantDifference,lal.epsilon))){
            transformed=true;
            var parentElementObj=elementList.getParent(elementObj);
            var frameRelativeToParent; //the frame of the viewpoint relative to the parent of the element we're trying to calculate position for
            //again, special treatment for second to top level objects
            if (elementList.getLevel(elementObj)==2)
              frameRelativeToParent=frame;
            else
              frameRelativeToParent=lal.dot(lal.inv(parentElementObj.effectiveGlobalFrame),frame);
            
            //get the viewpoint's position relative to element's parallax origin in the reference frame of the parent, then add parallax effect accordingly
            var positionFromOrigin=[frameRelativeToParent[0][2]-elementObj.parallaxOrigin[0],frameRelativeToParent[1][2]-elementObj.parallaxOrigin[1]];
            var parallaxAdjust=[[1-elementObj.parallax[0][0],-elementObj.parallax[0][1]],[-elementObj.parallax[1][0],1-elementObj.parallax[1][1]]];
            var transform=lal.dot(parallaxAdjust,positionFromOrigin);
            if (elementList.getLevel(elementObj)==2)
              transform=lal.dot(lal.inv(windowRotation),transform);
            transform=[
              [1,0,transform[0]],
              [0,1,transform[1]],
              [0,0,1]
            ];
            
            //concatenate the position adjustment from the parallax effect with the primordial transform found on the element
            appliedTransform=toTransform(transform)+" "+appliedTransform;
          }
        }
        
        //apply transform
        if (transformed||reset){
          elementObj.appliedTransform=appliedTransform;
          if ("transform" in bodystyle){
            if (reset){
              list[i].element.style.backfaceVisibility="hidden";
            }
            list[i].element.style.transform=appliedTransform+" translateZ(1px)";
          }
          if ("-webkit-transform" in bodystyle){
            if (reset){
              //list[i].element.style.WebkitPerspective="1000";
              list[i].element.style.WebkitBackfaceVisibility="hidden";
            }
            list[i].element.style.WebkitTransform=appliedTransform+" translateZ(1px)";
          }
          if ("-ms-transform" in bodystyle){
            if (reset){
              list[i].element.style.MsBackfaceVisibility="hidden";
            }
            list[i].element.style.MsTransform=appliedTransform+" translateZ(1px)";
          }
          if ("-moz-transform" in bodystyle){
            if (reset){
              list[i].element.style.MozBackfaceVisibility="hidden";
            }
            list[i].element.style.MozTransform=appliedTransform+" translateZ(1px)";
          }
          if ("-o-transform" in bodystyle){
            if (reset){
              list[i].element.style.OBackfaceVisibility="hidden";
            }
            list[i].element.style.OTransform=appliedTransform+" translateZ(1px)";
          }
        }
      }
      //document.body.dispatchEvent(translateEvent);
      return true;
    }
    
    //catalogue all elements and calculate their position based on the html/css
    var setLayout=function(element,doLayoutChilds){
      if (Displacement.isVoidTag(element.tagName))
        return;
      
      var parentElement=element.parentNode;
      var parentElementObj=elementList.fetch(parentElement);
      //check if an element has already been registered on the element list
      var elementObj=elementList.fetch(element);
      if (!elementObj){//create a list member if not registered
        elementObj=elementList.newElement(element);
        elementList.appendElement(elementObj,parentElementObj);
      }
      var data=parseData(splitData(element.getAttribute("data-Displacement")));
      elementObj.data=data;
      if (element==document.body){
        if (element.getAttribute("id")!="Displacement-framed"){
          setPosition(element,elementObj); //this calculates positioning
          element.setAttribute("id","Displacement-framed");
        }
      }else{
        setPosition(element,elementObj);
      }
      element.scrollTop=0;
      element.scrollLeft=0;
      //position other children
      if (doLayoutChilds){
        var children=element.children;
        var i;
        for (i=0;i<children.length;i++){
          if (children[i]) setLayout(children[i],true);
        }
      }
      return;
    }
    
    //calculate element position (non-parallax effects)
    function setPosition(element,elementObj){
      var data=elementObj.data
      if (element==document.body){
        //page.extents=[element.scrollHeight,element.scrollWidth];
        elementObj.doPosition="true";
        elementObj.size=page.extents; //at this point, extents should still equal [0,0]
        elementObj.center=lal.div(page.extents,2);
        //the "focus" attribute of the body element is the absolute point on the DOM that will be considered position [0,0] in page space and the center of the body object
        //the actual body element gets modified to have fixed positioning, but the body *object* has the "focus" coordinates stored as its center
        if (data["focus"]){
          var num;
          var bodyCenter=data["focus"];
          if (bodyCenter[0]){
            num=Number(bodyCenter[0])
            if (!isNaN(num)) elementObj.center[0]=num;
          }
          num=null;
          if (bodyCenter[1]){
            num=Number(bodyCenter[1])
            if (!isNaN(num)) elementObj.center[1]=num;
          }
          //yes, it's quite odd that the size of the body will always be the double of the coordinates of the "focus"; if the focus was [0,0] the size will also be [0,0]
          //but the size attribute of the body object doesn't actually affect the navigation limits of the web page.
          //It is what it is so that children of the body calculate their positions correctly
          elementObj.size=lal.mul(elementObj.center,2);
        }
        elementObj.contentSize=lal.clone(elementObj.size);
        elementObj.contentCenter=lal.clone(elementObj.center);
        elementObj.offsetParent=null;
        return;
      }
      var parentElement=element.parentNode;
      var parentElementObj=elementList.fetch(parentElement);
      var style=elementObj.style
      //positioning setup
      elementObj.doPosition=data["doPosition"];
      elementObj.doPosition=(elementObj.doPosition==null)?"true":elementObj.doPosition;
      
      //make sure the included class for this script doesn't mess with fixed position detection
      if (chkClass(element,"Displacement-F-absolute")){
        remClass(element,"Displacement-F-absolute");
        element.className+=" Displacement-A-absolute";
      }
      /*if (style.position!="absolute"){ //these elements will not have parallax effect, but their descendants may
        elementObj.doPosition="noparallax";
      }*/
      if (style.position=="fixed"){
        elementObj.doPosition="never";
      }
      if (parentElementObj.doPosition=="never"||elementObj.doPosition=="never"){ //these elements and their descendants will not have parallax effect
        elementObj.doPosition="never";
      }
      if (style.position=="fixed") //for our purposes, the parent objects of all objects of elements with fixed positioning is the body
        elementObj.offsetParent=elementList.fetch(document.body);
      else
        elementObj.offsetParent=elementList.fetch(element.offsetParent);
      //get parallax/movement parallax 
      var parallax=data["parallax"];
      elementObj.parallax=parallax;
      
      //get relative positions
      
      elementObj.size=[element.offsetHeight,element.offsetWidth];
      elementObj.contentSize=[element.scrollHeight,element.scrollWidth];
      
      //account for borders changing the size
      var borders={ //clientLeft, clientTop
      top:Number(style.borderTopWidth.replace("px","")),
      left:Number(style.borderLeftWidth.replace("px","")),
      bottom:Number(style.borderBottomWidth.replace("px","")),
      right:Number(style.borderRightWidth.replace("px",""))
      };
      //note: this is the center of the element WITHIN its borders. None of these are actually used but they may be useful in the future.
      elementObj.center[0]=(elementObj.size[0]+borders["top"]-borders["bottom"])/2;
      elementObj.center[1]=(elementObj.size[1]+borders["left"]-borders["right"])/2;
      elementObj.contentCenter=[elementObj.contentSize[0]/2,elementObj.contentSize[1]/2];
      
      //record the original CSS transform if any
      var originalTransform=(style.getPropertyValue('transform')
      || style.getPropertyValue('-moz-transform')
      || style.getPropertyValue('-webkit-transform')
      || style.getPropertyValue('-ms-transform')
      || style.getPropertyValue('-o-transform'));
      
      var parsedTransform=parseTransform(originalTransform);
      elementObj.originalTransform=originalTransform=parsedTransform[0];
      var stylePosition=getOffset(element)||[0,0];
      stylePosition=[stylePosition[0],stylePosition[1]];
      var noTranslateTransform=lal.clone(originalTransform);
      
      //if it's a 2D transform, add it to the relative position and also extract its rotation component; for the moment 3D transforms are ignored
      if (parsedTransform[0]!="2D")
        elementObj.DOMRelativePosition=stylePosition;
      else {
        elementObj.DOMRelativePosition=lal.add(stylePosition,[originalTransform[0][2],originalTransform[1][2]]);
        noTranslateTransform[0][2]=0;
        noTranslateTransform[1][2]=0;
      }
      
      //position of the element center relative to its parent's center, including borders as part of the element
      var centerPosition=[
        elementObj.DOMRelativePosition[0]+(elementObj.size[0]-parentElementObj.size[0])/2,
        elementObj.DOMRelativePosition[1]+(elementObj.size[1]-parentElementObj.size[1])/2,
      ];
      
      //centerPosition plus rotation specified by preexisting CSS transforms
      elementObj.centerRelativeMatrix=lal.dot([
        [1,0,centerPosition[0]],
        [0,1,centerPosition[1]],
        [0,0,1]
      ],noTranslateTransform);
      
      //now parallax and parallaxOrigin is factored in into relative position;
      //parallaxOrigin is the position relative to the parent that if the viewer centers the window on that position,
      //the element aligns back to its original CSS specified position relative to the parent
      var parallaxOrigin=data["parallaxOrigin"];
      
      //turn parallaxOrigin into numbers
      if (parallaxOrigin[0]=="parent"){
        parallaxOrigin=[Number(parallaxOrigin[2]),Number(parallaxOrigin[1])];
      }else if (parallaxOrigin[0]=="this"){
        parallaxOrigin=[centerPosition[0]+Number(parallaxOrigin[2]),centerPosition[1]+Number(parallaxOrigin[1])];
      }else
        parallaxOrigin=[0,0];
      elementObj.parallaxOrigin=parallaxOrigin;
      var invParallax=lal.inv(parallax);
      
      //calculate effective relative position using centerPosition, parallax, and parallaxOrigin
      //the effective relative position is the position relative to the parent element at which this element will be centered in the window
      //= parallax^-1 x (centerPosition - parallaxOrigin) + parallaxOrigin
      //= parallax^-1 x (centerPosition + parallax x parallaxOrigin - parallaxOrigin)
      var effectivePosition=lal.dot(
        invParallax,
        lal.sub(
          lal.add(
            centerPosition,
            lal.dot(
              parallax,
              parallaxOrigin
            )
          ),
          parallaxOrigin
        )
      );
      
      //now include rotation and parallax with the effective relative position
      var effectiveMatrix=lal.dot([
          [invParallax[0][0],invParallax[0][1],effectivePosition[0]],
          [invParallax[1][0],invParallax[1][1],effectivePosition[1]],
          [0,0,1]
        ],noTranslateTransform
      );
      
      //this is what will be used for most other calculations using element position
      //this is also a transform matrix that transforms coordinates relative to this element into coordinates relative to the offsetparent element
      elementObj.effectiveMatrix=effectiveMatrix;
      
      remClass(element,"Displacement-A-absolute");
      if (elementObj.doPosition=="true"&&elementList.getLevel(elementObj)==2) element.className+=" Displacement-F-absolute";
      //console.log([element],elementObj.DOMRelativePosition,centerPosition,elementObj.centerRelativeMatrix,parallaxOrigin,effectivePosition,effectiveMatrix);
      return;
    }
    
    //sets effectiveGlobalFrame and effectiveDocumentFrame for an element and its childs. Used if an element has changed position
    //effectiveDocumentFrame is important because it stores rotational data rather than  rotational data mixed with parallax
    function updateGlobalPositions(elementObj){
      var element=elementObj.element;
      if (element!=document.body){
        var parentElement=element.parentNode;
        var parentElementObj=elementList.fetch(parentElement);
        elementObj.effectiveGlobalFrame=lal.dot(parentElementObj.effectiveGlobalFrame,elementObj.effectiveMatrix);
        var SVD=lal.svd(lal.getBlock(elementObj.effectiveGlobalFrame,[0,0],[1,1])); //use SVD to extract the rotation aspect of a transformation matrix
        var rotation=lal.dot(SVD.U,lal.transpose(SVD.V));
        elementObj.effectiveDocumentFrame=lal.setBlock(lal.clone(elementObj.effectiveGlobalFrame),[0,0],[1,1],rotation);
        //console.log(element,elementObj.effectiveGlobalFrame,elementObj.effectiveDocumentFrame,elementObj.effectiveMatrix,lal.inv(elementObj.parallax));
      }
      var childs=elementList.getChildren(elementObj);
      if (childs){
        var i;
        for (i in childs){
          updateGlobalPositions(childs[i]);
        }
      }
    }
    
    //get the farthest possible coordinates of the page that elements will possibly reach or the body "limit" custom attribute, whichever is farther
    this.getExtents=function(){
      var extents=[[0,0],[0,0]];
      var list=elementList.getList();
      var diagonal,test;
      for (i in list){
        if (!list[i]||list[i].element==document.body) continue;
        diagonal=pythag(list[i].size[0],list[i].size[1]);
        test=[list[i].effectiveDocumentFrame[0][2]-diagonal,list[i].effectiveDocumentFrame[1][2]-diagonal,list[i].effectiveDocumentFrame[0][2]+diagonal,list[i].effectiveDocumentFrame[1][2]+diagonal];
        if (test[0]<extents[0][0]) extents[0][0]=test[0];
        if (test[1]<extents[0][1]) extents[0][1]=test[1];
        if (test[2]>extents[1][0]) extents[1][0]=test[2];
        if (test[3]>extents[1][1]) extents[1][1]=test[3];
      }
      var bodyObj=elementList.fetch(document.body);
      if (!isNaN(bodyObj.data["limit"][0])) extents[0][1]=bodyObj.data["limit"][0];
      if (!isNaN(bodyObj.data["limit"][1])) extents[0][0]=bodyObj.data["limit"][1];
      if (!isNaN(bodyObj.data["limit"][2])) extents[1][1]=bodyObj.data["limit"][2];
      if (!isNaN(bodyObj.data["limit"][3])) extents[1][0]=bodyObj.data["limit"][3];
      return extents;
    };
    
    //retrieves the "focus" custom attribute of the object
    this.getFocus=function(element){
      var elementObj=elementList.fetch(element);
      return lal.dot(elementObj.effectiveGlobalFrame,[
        [1,0,elementObj.data["focus"][1]],
        [0,1,elementObj.data["focus"][0]],
        [0,0,1]]);
    };
    
    //retrieves the position of the window relative to the page
    this.getFrame=function(){
      return lal.clone(windowFrame);
    }
  };

  //the element catalogue object, a list of objects that each reference an element, its parent, and its calculated positions and data
  //uses structured key string values to index the objects, because I didn't want to have an object reference its parent and have cyclic references
  var elementList=new function(){
    var lastChildID=0;
    var list={};
    var thisID="element";
    
    //tries to retrieve an object corresponding to an element
    this.fetch=function(element){
      if (!element) return;
      var elementID;
      if (typeof element=="string")
        elementID=element;
      else{
        if (element.thisID)
          elementID=element.thisID;
        else if (element.getAttribute)
          elementID=element.getAttribute("data-Displacement-elementID");
      }
      if (elementID){
        return list[elementID];
      }
      return null;
    };
    
    //tries to get the parent 
    this.getParent=function(elementObj){
      thisID=elementObj.thisID;
      lastDash=thisID.lastIndexOf("-")
      parentID=thisID.slice(0,lastDash);
      if (parentID=="element")
        return null;
      else
        return list[parentID];
    };
    
    //gets the number of parents the element has, plus 1
    this.getLevel=function(elementObj){
      var elementID=elementObj;
      if (!(typeof elementID=="string"))
        elementID=elementObj.thisID;
      return elementID.match(/-/g).length;
    };
    
    //get direct childs of an element
    this.getChildren=function(elementObj){
      var elementID=elementObj.thisID;
      var childLevel=elementList.getLevel(elementObj)+1;
      if (elementID){
        var childs=[];
        var key;
        for (key in list){
          if (key.search(elementID)>-1&&key!=elementID&&elementList.getLevel(key)==childLevel)
            childs.push(list[key]);
        }
        if (childs.length==0)
          return null;
        else
          return childs;
      }
      return null;
    };
    
    //new list member constructor
    this.newElement=function(node){
      return {
        element:node,
        offsetParent:{},
        doPosition:false,
        style:window.getComputedStyle(node),
        data:{},
        thisID:"",
        lastChildID:0,
        parallax:lal.clone(I2),
        parallaxOrigin:[0,0],
        originalTransform:lal.clone(I3),
        appliedTransform:lal.clone(I3),
        size:[],
        contentSize:[],
        center:[],
        contentCenter:[],
        effectiveMatrix:[],
        effectiveGlobalFrame:lal.clone(I3),
        effectiveDocumentFrame:lal.clone(I3),
        DOMRelativePosition:[],
        centerRelativeMatrix:[],
        //DOMRelativeToParallaxParent:[],
        //centerRelativeToParallaxParent:[]
      };
    };
    
    //adds an object to the list with parent as parentObj
    this.appendElement=function(elementObj,parentObj){
      if (!parentObj){
        var parentID=thisID;
        lastChildID++;
        var newID=parentID+"-"+lastChildID;
        elementObj.thisID=newID;
        elementObj.element.setAttribute("data-Displacement-elementID",newID);
        list[newID]=elementObj;
        return newID;
      }else{
        var parentID=parentObj.thisID;
        if (!parentID)
          return null;
        parentObj.lastChildID++;
        var newID=parentID+"-"+parentObj.lastChildID;
        elementObj.thisID=newID;
        elementObj.element.setAttribute("data-Displacement-elementID",newID);
        list[newID]=elementObj;
        return newID;
      }
    };
    
    //remove object and its children from the list
    this.removeElement=function(elementObj,removeDescendants){
      var removedID=elementObj.thisID;
      if (removeDescendants){
        var childs=elementList.getChildren(elementObj);
        if (childs)
        {
          var i;
          for (i in childs){
            elementList.removeElement(childs[i],true);
          }
        }
      }
      delete list[removedID];
      return;
    };
    
    //gives you the entire list
    this.getList=function(){
      return list;
    };
  };

  //the object that contains all the interactivity
  var nav=new function(){
    var currentHash;
    var scrollTester,scrollSpanner,scrollCountdown=5;
    var eventElement,moveAction;
    var scrollCorner=[0,0];
    this.doScroll=false;
    this.doParallaxScroll=false;
    this.doDrag=false;
    this.doParallaxDrag=false;
    this.doSnap=false;
    var mouseHeld=false,dragging=false;
    this.mouseDragThreshold=4;
    var eventFired=false,refreshing=false,animation,animationTimeout;
    var mouseTarget={},lastMousePosition,recentMouseAction="click";
    var elementSnapTo;
    this.homeHash="";
    this.currentElement;
    this.doAnimate=0;
    this.animateTiming="linear";
    this.initialize=function(hash,animate){
      //page.windowOffsetFactor=1.5;
  //    document.addEventListener("mousemove",function(event){console.log(event.target.tagName,document.elementFromPoint(event.clientX, event.clientY))});
      
      //even if I use feature detection, they never all work the same way
      var browserOS=[BrowserDetect.browser,BrowserDetect.OS,BrowserDetect.version];
      
      scrollTester=document.createElement("div");
      scrollTester.className="Displacement-scrolltester";
      scrollTester.setAttribute("data-Displacement","doPosition:never;");
      
      scrollSpanner=document.createElement("div");
      scrollSpanner.setAttribute("id","Displacement-scrollspanner");
      
      eventElement=document.createElement("div");
      eventElement.setAttribute("id","Displacement-Event");
      
      document.body.appendChild(scrollTester);
      document.body.appendChild(scrollSpanner);
      document.body.appendChild(eventElement);
      scrollerSize();
      
      //also IE doesn't use Event object properly
      if (document.createEventObject||(browserOS[0]=="Explorer")){
        moveAction=document.createEvent("MouseEvents");
        moveAction.initMouseEvent("mouseover",true,true,window,0,0,0,0,0,false,false,false,false,0,null);
      }else if (Event){
        moveAction=new Event("mouseover");
      }
      
      if (window.addEventListener){
        window.addEventListener("resize",scrollerSize,false);
        window.addEventListener("scroll",scrolled,false);
        document.body.addEventListener("click",navClick,false);
        window.addEventListener("keydown",keymgr,false);
        window.addEventListener("mousemove",mouseMoved,false);
        window.addEventListener("mousedown",mouseButtonDown,false);
        window.addEventListener("mouseup",mouseButtonUp,false);
        window.addEventListener("mouseover",mouseIFrame,false);
        //window.addEventListener("hashchange",hashChanged,false);
      }else if (window.attachEvent){
        window.attachEvent("resize",scrollerSize);
        document.body.attachEvent("scroll",scrolled);
        document.body.attachEvent("click",navClick);
        window.attachEvent("keydown",keymgr);
        window.attachEvent("mousemove",mousemoved);
        window.attachEvent("mousedown",mouseButtonDown);
        window.attachEvent("mouseup",mouseButtonUp);
        window.attachEvent("mouseoover",mouseIFrame);
        //window.attachEvent("hashchange",hashChanged);
      }
      
      //window.addEventListener("mousewheel",function(event){console.log(event.wheelDeltaX,event.wheelDeltaY,event.deltaZ)});
      //document.body.addEventListener("mousemove",function(event){console.log("move",event.target.getAttribute("id"));},false);
      
      //Firefox scrolling on Windows behaves unusually by stopping all scrolling momentum when a script sets scroll momentum.
      //No smartphones nor Macs nor IE do this, so Firefox is the odd one out and I have to use browser detection.
      if (browserOS[0].toLowerCase()=="firefox"&&browserOS[1].toLowerCase()=="windows"){
        firefoxwindows();
      }
      
      if (animate) nav.doAnimate=animate;
      
      if (!hash){
        if (window.location.hash!=""){
          hash=window.location.hash.replace("#","");
        }
      }else{
        nav.homeHash=hash;
      }
      
      if (hash&&page.initialized()){
        currentHash=hash;
        nav.goTo(hash,0);
        page.reTranslate();
      }
    };
    
    /*
    function eventCall(fn){
      if (eventFired){
        eventFired=false;
        refreshing=true;
        var request;
        if (fn) requestAnimationFrame(function(){fn(); eventCall(fn);});
      }else refreshing=false;
    }
    
    function eventManager(fn){
      if (!refreshing){
        eventFired=true;
        eventCall(fn);
      }
    }
    */
    
    //change the hash in the url after navigation to a new area
    function changeHash(hash){
      var location=document.getElementById(hash);
      if (location){
        var oldHash=window.location.hash.replace("#","");
        if (oldHash!=hash){
          currentHash=hash;
          location.id=""; //remove the original id/hash to prevent redirect
          //window.location.hash="";
          window.location.hash=hash; //change the hash
          location.id=hash; //replace the id
        }
      }else{
        currentHash=hash;
        window.location.hash=hash;
      }
      scrolled(true);
    }
    
    //intercepts link clicks that point to a hash on this page and navigates the viewpoint to the destination of the hash
    function navClick(event){
      var tgt=event.target;
      var chkLink=function(target){
        if (target.tagName=="A"){
          var link=target.getAttribute("href");
          if (link&&link.match(/^#/)){
            event.preventDefault();
            if (recentMouseAction=="click"){
              link=link.replace("#","");
              nav.goTo(link,nav.doAnimate);
            }else return false;
          }
          return true;
        }else return false;
      };
      while(!chkLink(tgt)){
        tgt=tgt.parentElement;
        if (tgt==document.body) break;
      }
    }
    
    //detect button down for mouse dragging
    function mouseButtonDown(event){
      if (event.button!=0) return;
      mouseHeld=true;
      event.preventDefault();
      nav.stopAnimation();
      recentMouseAction="click";
      if(window.getSelection){ //deselects all text if enabled, for non IE browsers
        window.getSelection().removeAllRanges();
      }
      if(document.selection){ //IE version of above code
        document.selection.empty();
      }
    }
    
    //detect button up to stop mouse dragging
    function mouseButtonUp(event){
      if (event.button!=0) return;
      mouseHeld=false;
      if (dragging){
        event.preventDefault();
        recentMouseAction="drag";
        dragging=false;
        snap();
      }else{
        recentMouseAction="click";
      }
    }
    
    //stop dragging also if mouse goes over an iframe
    function mouseIFrame(event){
      if (event.target){
        if (event.target.tagName=="IFRAME"){
          mouseButtonUp(event);
        }
      }
    }
    
    //dragging stuff
    function mouseMoved(event){
      var newPosition=[event.screenY,event.screenX];
      if (!dragging){
        if (!mouseHeld){
          if (!mouseTarget.elem||mouseTarget.elem!=event.target){
            mouseTarget.elem=event.target;
            mouseTarget.elemObj=elementList.fetch(mouseTarget.elem);
          }
          lastMousePosition=newPosition;
        }else{
          var diff=lal.sub(newPosition,lastMousePosition);
          if (Math.abs(diff[0])>nav.mouseDragThreshold||Math.abs(diff[1])>nav.mouseDragThreshold){
            dragging=true;
            lastMousePosition=newPosition;
            recentMouseAction="drag";
          }
        }
      }else{
        if (lastMousePosition){
          dragged(lastMousePosition,newPosition);
        }
        lastMousePosition=newPosition;
      }
    }
    
    //shift the web page if scrolled or dragged; accounts for the parallax of the object being dragged
    function shift(newPosition,oldPosition,caller){
      var change=lal.sub(newPosition,oldPosition);
      var rotation,transform;
      if (page.initialized()){
        eventElement.dispatchEvent(moveAction);
        window.scrollTo(scrollCorner[1],scrollCorner[0]);
        if (caller=="scrolled"&&nav.doParallaxScroll||caller=="dragged"&&nav.doParallaxDrag)
        {
          if (mouseTarget.elemObj&&mouseTarget.elemObj.effectiveDocumentFrame&&mouseTarget.elemObj.effectiveGlobalFrame){
            rotation=lal.dot(lal.inv(lal.getBlock(mouseTarget.elemObj.effectiveDocumentFrame,[0,0],[1,1])),lal.getBlock(page.getFrame(),[0,0],[1,1]));
            transform=lal.getBlock(mouseTarget.elemObj.effectiveGlobalFrame,[0,0],[1,1]);
            change=lal.dot(transform,lal.dot(rotation,change));
            page.move(change);
            return;
          }
        }
        page.shift(change)
        return;
      }
    }
    
    //called if the mousemoved event handler detects mouse dragging
    function dragged(newPosition,oldPosition){
      if (!nav.doDrag) return;
      shift(newPosition,oldPosition,"dragged");
      nav.stopAnimation();
    }
    
    //event handler for scroll event or link to unknown hash
    function scrolled(reset){
      if (nav.doScroll){
        if (!(reset==true)){
          var newPosition=[document.body.scrollTop||document.documentElement.scrollTop,document.body.scrollLeft||document.documentElement.scrollLeft];
          if (scrollCountdown>0)
            scrollCountdown--;
          else
            shift(newPosition,scrollCorner,"scrolled");
          nav.stopAnimation();
          snap();
        }
      }
      window.scrollTo(scrollCorner[1],scrollCorner[0]);
    }
    
    //was intended to cause navigation if user manually changed the url in the address bar
    /*function hashChanged(event){
      var hash=window.location.hash.replace("#","");
      nav.goTo(hash,nav.doAnimate)
    }*/
    
    //find the element below the center of the screen
    //if an element has snapping disabled, it recursively searches elements under it.
    this.getSnapTo=function(pos,elementObj){
      if (!elementObj) elementObj=elementList.fetch(document.elementFromPoint(pos[1],pos[0]));
      var noSnaps=true;
      if (elementObj){
        if (elementObj.element==document.body) return [elementObj,noSnaps];
        if (elementObj.data["snap"]=="snap"){
          if (elementObj.element.id==currentHash)
            return [elementObj,noSnaps];
          else{
            noSnaps=false;
            return [elementObj,noSnaps];
          }
        }else if (elementObj.data["snap"]=="parent") {
          return nav.getSnapTo(pos,elementList.getParent(elementObj));
        }else{
          elementObj.element.className+=" Displacement-snap-hidden";
          var pair = nav.getSnapTo(pos);
          remClass(elementObj.element,"Displacement-snap-hidden");
          return pair;
        }
      }
      return [elementObj,noSnaps];
    }
    
    //detect and snap the viewpoint to elements
    function snap(){
      if (!nav.doSnap) return;
      nav.stopAnimation();
      var halfWindowSize=lal.div(page.windowSize,2);
      var snapper=function(){
        var snapTo=nav.getSnapTo(halfWindowSize);
        var elementObj=snapTo[0];
        var noSnaps=snapTo[1];
        if (!noSnaps){
          nav.goTo(elementObj.element.id,nav.doAnimate);
          //changeHash(elementObj.element.id);
        }else{
          var bounce=false;
          elementObj=elementList.fetch(document.getElementById(currentHash));
          if (elementObj){
            var relativeToElement=lal.inv(elementObj.relativeToWindow);
            var bounds=lal.div(elementObj.size,2);
            var limit=[bounds[0]-((bounds[0]<halfWindowSize[0])?bounds[0]:halfWindowSize[0]),bounds[1]-((bounds[1]<halfWindowSize[1])?bounds[1]:halfWindowSize[1])];
            var dist=[0,0];
            //console.log([relativeToElement[0][2],relativeToElement[1][2]],bounds);
            if (
              ((relativeToElement[0][2]+limit[0])>-halfWindowSize[0])&&
              ((relativeToElement[0][2]-limit[0])<halfWindowSize[0])&&
              ((relativeToElement[1][2]+limit[1])>-halfWindowSize[1])&&
              ((relativeToElement[1][2]-limit[1])<halfWindowSize[1])
            ){
              if ((relativeToElement[0][2]+limit[0])<0){
                bounce=true;
                dist[0]=relativeToElement[0][2]+limit[0];
                relativeToElement[0][2]=-limit[0];
              }
              if ((relativeToElement[0][2]-limit[0])>0){
                bounce=true;
                dist[0]=relativeToElement[0][2]-limit[0];
                relativeToElement[0][2]=limit[0];
              }
              if ((relativeToElement[1][2]+limit[1])<0){
                bounce=true;
                dist[1]=relativeToElement[1][2]+limit[1];
                relativeToElement[1][2]=-limit[1];
              }
              if ((relativeToElement[1][2]-limit[1])>0){
                bounce=true;
                dist[1]=relativeToElement[1][2]-limit[1];
                relativeToElement[1][2]=limit[1];
              }
            }else{
              changeHash("");
            }
            var destination=lal.dot(elementObj.effectiveGlobalFrame,relativeToElement);
            if (bounce){
              nav.goTo(destination,nav.doAnimate*(pythag(dist[0],dist[1])/pythag(halfWindowSize[0],halfWindowSize[1]))+100,"power-inout,2");
            }
          }
        }
      };
      animationTimeout=window.setTimeout(snapper,50);
    }
    
    //animated navigation function
    this.goTo=function(id,animateTime,timing){
      var elementFrame,windowFrame,windowRotation,elementRotation;
      if (typeof id==="string"){
        var element=document.getElementById(id);
        var elementObj=elementList.fetch(element);
        if (!element||!elementObj) return;
        elementFrame=page.getFocus(elementObj);
        elementRotation=lal.getBlock(lal.clone(elementObj.effectiveDocumentFrame),[0,0],[1,1]);
        elementFrame=lal.setBlock(lal.round(elementFrame),[0,0],[1,1],elementRotation);
      }else{
        if (Object.prototype.toString.call(id)==="[object Array]"){
          elementFrame=id;
          elementRotation=lal.getBlock(elementFrame,[0,0],[1,1]);
        }
      }
      nav.stopAnimation();
      elementRotation=fromRotationMatrix(elementRotation);
      
      windowFrame=page.getFrame();
      windowRotation=lal.getBlock(windowFrame,[0,0],[1,1]);
      windowRotation=fromRotationMatrix(windowRotation);
      
      var angle=elementRotation-windowRotation;
      if (angle>Math.PI) angle=angle-Math.PI*2;
      if (angle<-Math.PI) angle=angle+Math.PI*2;
      var difference=lal.sub([elementFrame[0][2],elementFrame[1][2]],[windowFrame[0][2],windowFrame[1][2]]);
      animateTime=Number(animateTime);
      if (!isNaN(animateTime)&&animateTime>0){
        timing=(typeof timing==="undefined")?nav.animateTiming:timing;
        var startTime,progress,matrix,coords;
        var frameAnimate=function(){
          progress=animateFunction((Date.now()-startTime)/animateTime,timing);
          matrix=toRotationMatrix(angle*progress+windowRotation);
          coords=lal.add([windowFrame[0][2],windowFrame[1][2]],lal.mul(difference,progress));
          page.goTo([
            [matrix[0][0],matrix[0][1],coords[0]],
            [matrix[1][0],matrix[1][1],coords[1]],
            [0,0,1]]);
        };
        startTime=Date.now();
        animation=window.setInterval(frameAnimate,1000/60);
        var animationCopy=animation;
        animationTimeout=window.setTimeout(function(){if (animation&&animation==animationCopy){nav.stopAnimation(); page.goTo(elementFrame); if (typeof id==="string") changeHash(id);}},animateTime);
      }else{
        page.goTo(elementFrame);
        if (typeof id==="string") changeHash(id);
      }
    }
    
    //self explanatory
    this.stopAnimation=function(){
      if (animation){
        window.clearInterval(animation);
        animation=null;
      }
      if (animationTimeout){
        window.clearTimeout(animationTimeout);
        animationTimeout=null;
      }
    }
    
    //animation curve function
    function animateFunction(progress,fn){
      fn=(typeof fn==="undefined")?"linear":fn;
      fn=fn.split(",");
      var pow=Number(fn[1]);
      if (isNaN(pow)) pow=2;
      fn=fn[0];
      var result;
      if (progress<0) result=0;
      if (progress>1) result=1;
      switch(fn)
      {
        case "sine-in":
          result=1-Math.cos(progress*Math.PI/2);
          break;
        case "sine-out":
          result=Math.sin(progress*Math.PI/2);
          break;
        case "sine-inout":
          result=0.5-(Math.cos(progress*Math.PI)/2);
          break;
        case "power-in":
          result=Math.pow(progress,pow);
          break;
        case "power-out":
          result=1-Math.pow(1-progress,pow);
          break;
        case "power-inout":
          result=(progress<=0.5)?(Math.pow(progress,pow)*Math.pow(2,pow-1)):1-Math.pow(2,pow-1)*Math.pow(1-progress,pow);
          break;
        case "circ-in":
          result=1-Math.sqrt(1-Math.pow(progress,2));
          break;
        case "circ-out":
          result=Math.sqrt(1-Math.pow(1-progress,2));
          break;
        case "circ-inout":
          result=(progress<=0.5)?0.5-Math.sqrt(0.25-Math.pow(progress,2)):0.5+Math.sqrt(0.25-Math.pow(1-progress,2));
          break;
        default:
          result=progress;
          break;
      }
      return result;
    }
    
    //treat certain keypresses specially
    function keymgr(event){
      switch(event.keyCode)
      {
        case 9: //prevent tab from doing anything
          event.preventDefault();
          break;
        case 36: //home button navigates to home
          event.preventDefault();
          nav.goTo(nav.homeHash,nav.doAnimate);
          break;
        default:
          break;
      }
    }
    
    //a thing to find the size of the scrollbar so I can move it out of the way
    function scrollerSize(noscroll){
      var width=scrollTester.offsetWidth-scrollTester.clientWidth;
      var height=scrollTester.offsetHeight-scrollTester.clientHeight;
      var windowSize=[window.innerHeight,window.innerWidth];
      var size=[windowSize[0]+height,windowSize[1]+width];
      var span=[windowSize[0]*3,windowSize[1]*3];
      scrollCorner=[windowSize[0],windowSize[1]];
      //document.body.style.height=size[0]+"px";
      //document.body.style.width=size[1]+"px";
      window.scrollTo(scrollCorner[1],scrollCorner[0]);
      document.body.removeChild(scrollSpanner);
      scrollSpanner.style.height=span[0]+"px";
      scrollSpanner.style.width=span[1]+"px";
      document.body.appendChild(scrollSpanner);
    }
    
    //special scrolling behavior for firefox
    function firefoxwindows(){
      // left: 37, up: 38, right: 39, down: 40,
      // spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36
      var keys = [32,33,34,37,38,39,40];
      var keyscroll={};
      keyscroll[32]=function(){window.scrollBy(0,scrollCorner[0]);};
      keyscroll[33]=function(){window.scrollBy(0,-scrollCorner[0]);};
      keyscroll[34]=function(){window.scrollBy(0,scrollCorner[0]);};
      keyscroll[37]=function(){window.scrollBy(-10,0);};
      keyscroll[38]=function(){window.scrollBy(0,-10);};
      keyscroll[39]=function(){window.scrollBy(10,0);};
      keyscroll[40]=function(){window.scrollBy(0,10);};
      function wheel(event){
        window.scrollBy(event.deltaX*10,event.deltaY*10);
        event.preventDefault();
      }
      function keydown(event){
        for (i in keys){
          if (event.keyCode===keys[i]){
            if (keyscroll[event.keyCode]) keyscroll[event.keyCode]();
          }
        }
      }
      window.addEventListener("wheel",wheel);
      window.addEventListener("keydown",keydown);
    }
  }

};
