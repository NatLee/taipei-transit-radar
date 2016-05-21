var _body = document.getElementsByTagName("body")[0];

function init() {
  $("#change")[0].addEventListener("click", changeEvent);
  $("#search")[0].addEventListener("click", searchEvent);
  $("html, body").animate({
    scrollTop: 0
  }, 300);
}

function changeEvent(e) {
  var startValue = $("#start")[0].value;
  var endValue = $("#end")[0].value;

  $("#start")[0].value = endValue;
  $("#end")[0].value = startValue;




  //$("#start")[0].value(end);
  //$("#end")[0].value(start);
}


function searchEvent(e) {
  $("#walk")[0].innerHTML = "";
  $("#bus")[0].innerHTML = "";
  $("#mrt")[0].innerHTML = "";
  callGoogleServer("WALKING", "WALK");
  callGoogleServer("TRANSIT", "BUS");
  callGoogleServer("TRANSIT", "RAIL");

  setTimeout(function () {


    $("#P1")[0].innerHTML = "";
    $("#label1")[0].innerHTML = "總花費(越大越多)";

    $("#P2")[0].innerHTML = "";
    $("#label2")[0].innerHTML = "總距離(越大越遠)";

    $("#P3")[0].innerHTML = "";
    $("#label3")[0].innerHTML = "總耗時(越大越久)";
    var js;
    js = getJsonByView("money");

    createD3JS(js, "#P1");
    js = getJsonByView("distance"); //距離
    createD3JS(js, "#P2");
    js = getJsonByView("time");
    createD3JS(js, "#P3");

  }, 1000);




}

function getJsonByView(mode) {
  var js = {
    "name": "flare",
    "children": [
      {
        "name": "analytics",
        "children": [
          {
            "name": getColor(),
            "children": [
              {
                "name": "走路",
                "size": 3938
              },
              {
                "name": "公車",
                "size": 3812
              },
              {
                "name": "捷運",
                "size": 6714
              }
            ]
          }
        ]
      }
    ]
  };

  var temp = js["children"][0]["children"][0]["children"];
  if (mode == "money") {
    temp[0]["size"] = 1;
    temp[1]["size"] = $("#bus")[0].innerHTML.split("<br>")[3].split("$")[1];
    temp[2]["size"] = $("#mrt")[0].innerHTML.split("<br>")[3].split("$")[1];
  }
  else if (mode == "distance")//距離
  {
    temp[0]["size"] = $("#walk")[0].innerHTML.split("<br>")[6].split("：")[1].split(" ")[0];
    temp[1]["size"] = $("#bus")[0].innerHTML.split("<br>")[6].split("：")[1].split(" ")[0];
    temp[2]["size"] = $("#mrt")[0].innerHTML.split("<br>")[6].split("：")[1].split(" ")[0];

  }
  else {
    var bus_D = $("#bus")[0].innerHTML.split("<br>")[4].split("：")[1].replace("上午", "").replace("下午", "").split(":");
    var bus_A = $("#bus")[0].innerHTML.split("<br>")[5].split("：")[1].replace("上午", "").replace("下午", "").split(":");

    var mrt_D = $("#mrt")[0].innerHTML.split("<br>")[4].split("：")[1].replace("上午", "").replace("下午", "").split(":");
    var mrt_A = $("#mrt")[0].innerHTML.split("<br>")[5].split("：")[1].replace("上午", "").replace("下午", "").split(":");


    temp[0]["size"] = $("#walk")[0].innerHTML.split("<br>")[4].split("：")[1].replace("分", "");
    temp[1]["size"] = (bus_A[0] - bus_D[0])*60 + (bus_A[1] - bus_D[1]);
    temp[2]["size"] = (mrt_A[0] - mrt_D[0]) * 60 + (mrt_A[1] - mrt_D[1]);
  }



  return js;
}

function createD3JS(js, type) {

  var diameter = 250,
      format = d3.format(",d"),
      color = d3.scale.category20c();

  var bubble = d3.layout.pack()
      .sort(null)
      .size([diameter, diameter])
      .padding(1.5);

  var svg = d3.select(type).append("svg")
      .attr("width", diameter)
      .attr("height", diameter)
      .attr("class", "bubble");

  var node = svg.selectAll(".node")
      .data(bubble.nodes(classes(js))
      .filter(function (d) { return !d.children; }))
    .enter().append("g")
      .attr("class", "node")
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

  node.append("title")
      .text(function (d) { return d.className + ": " + format(d.value); });

  node.append("circle")
      .attr("r", function (d) { return d.r; })
      .style("fill", function (d) {
        return d.packageName;//color(d.packageName);
      });

  node.append("text")
      .attr("dy", ".3em")
      .style("text-anchor", "middle")
      .text(function (d) { return d.className.substring(0, d.r / 3); });

  // Returns a flattened hierarchy containing all leaf nodes under the root.
  function classes(root) {
    var classes = [];
    function recurse(name, node) {
      if (node.children) node.children.forEach(function (child) { recurse(node.name, child); });
      else classes.push({ packageName: name, className: node.name, value: node.size });
    }
    recurse(null, root);
    return { children: classes };
  }
  d3.select(self.frameElement).style("height", diameter + "px");
}

function getColor() {
  var r = Math.floor(Math.random() * 105)+150;
  var g = Math.floor(Math.random() * 105)+150;
  var b = Math.floor(Math.random() * 105)+150;
  return rgbToHex(r, g, b);
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function callGoogleServer(classTran, type) {
  var startValue = $("#start")[0].value;
  var endValue = $("#end")[0].value;

  var directionsService = new google.maps.DirectionsService();
  var directionsRequest = {
    origin: startValue,
    destination: endValue,
    travelMode: google.maps.DirectionsTravelMode[classTran],
    optimizeWaypoints: true,
    unitSystem: google.maps.UnitSystem.METRIC
  };

  if (classTran == "TRANSIT") {
    directionsRequest["transitOptions"] = {
      modes: [google.maps.TransitMode[type]]
    };
  }

  var json_bus, json_tram, temp_bus

  directionsService.route(directionsRequest, function (response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      temp = response["routes"][0];

      var dis = 0;
      for (var i = 0; i < temp["legs"].length; i++) {
        dis += temp["legs"][i]["distance"]["value"];
      }
      dis = dis / 1000;


      var steps = temp["legs"][0]["steps"];
      var stepString = "";
      for (var i = 0; i < steps.length; i++) {
        if (steps[i]["transit"] && steps[i]["transit"]["line"]) {
          if (steps[i]["transit"]["line"]["name"])
            stepString += steps[i]["transit"]["line"]["name"];
          if (steps[i]["transit"]["line"]["short_name"])
            stepString += "(" + steps[i]["transit"]["line"]["short_name"] + ")";
        }
      }
      if (type == "WALK" && stepString == "")
        stepString = "腳";

      if (type == "BUS")
        type = "公車";
      else if (type == "RAIL")
        type = "捷運";
      else
        type = "走路";

      var cost = "TWD $0";
      if (temp["fare"] && temp["fare"]["currency"])
        cost = temp["fare"]["currency"] + " " + temp["fare"]["text"];

      var departure = new Date().toLocaleString().split(' ')[1];
      departure = getViewDate(departure);
      if (temp["legs"][0]["departure_time"] && temp["legs"][0]["departure_time"]["text"])
        departure = temp["legs"][0]["departure_time"]["text"];

      var arrived = addMins(temp["legs"][0]["duration"]["value"]).toLocaleString().split(' ')[1];
      //if (navigator.vendor.indexOf("Apple") > -1) {
      //  arrived = arrived[4];
      //}
      //else
      //  arrived = arrived[1];
      arrived = getViewDate(arrived);
      if (temp["legs"][0]["arrival_time"] && temp["legs"][0]["arrival_time"]["text"])
        arrived = temp["legs"][0]["arrival_time"]["text"];

      if (type == "走路") {
        var min = temp["legs"][0]["duration"]["value"] / 60;
        var num = new Number(dis / (min / 60) * 46.5)

        $("#walk")[0].innerHTML += "</br>大眾交通工具：" + type +
          "</br>搭乘車號：" + stepString +
          "</br>花費金額：" + cost +
          "</br>花費時間：" + temp["legs"][0]["duration"]["text"] +
          "</br>消耗卡路里：" + num.toFixed(2) + "大卡(60公斤計)" +
          "</br>距離總長：" + dis + " 公里</br>";
      }
      else if (type == "公車") {
        $("#bus")[0].innerHTML += "</br>大眾交通工具：" + type +
          "</br>搭乘車號：" + stepString +
          "</br>花費金額：" + cost +
          "</br>出發時間：" + departure +
          "</br>抵達時間：" + arrived +
          "</br>距離總長：" + dis + " 公里</br>";
      }
      else {
        $("#mrt")[0].innerHTML += "</br>大眾交通工具：" + type +
      "</br>搭乘車號：" + stepString +
      "</br>花費金額：" + cost +
      "</br>出發時間：" + departure +
      "</br>抵達時間：" + arrived +
      "</br>距離總長：" + dis + " 公里</br>";
      }
    }
    else
      alert("Unable to retrieve your route");
  });
}

function getViewDate(d) {
  var ary = d.split(':');
  return ary[0] + ":" + ary[1];
}

function addMins(min) {
  var d = new Date().getTime();

  return new Date(d + min * 1000);
}


init();
