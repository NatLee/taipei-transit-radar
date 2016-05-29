var _body = document.getElementsByTagName("body")[0];

function init() {

  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))  //是手機的話
    $("#element")[0].style["width"] = "100%";


  $("#change")[0].addEventListener("click", changeEvent);
  $("#search")[0].addEventListener("click", searchEvent);
  createCombobox("#start");
  createCombobox("#end");

  $("html, body").animate({
    scrollTop: 0
  }, 300);


  $(document).ready(function () {
    $(window).scroll(function () {
      if ($(this).scrollTop() > 100) {
        $('.scrollup').fadeIn();
      } else {
        $('.scrollup').fadeOut();
      }
    });

    $('.scrollup').click(function () {
      $("html, body").animate({
        scrollTop: 0
      }, 600);
      return false;
    });

  });
  geoFindMe();
}

function radioChange(e) {
  var imgDiv = document.getElementById("img");
  var word = document.getElementById("word");
  var src = "";
  var str = "";

  var walk = $("#walk")[0].innerHTML;
  var bus = $("#bus")[0].innerHTML;
  var mrt = $("#mrt")[0].innerHTML;

  var createMap = false;

  if (walk == "" || bus == "" || mrt == "")
    str = "資料不正確，請查明資料";
  else if (e.value == "money") {
    src = "url(images/walking.png)";
    str = walk;
  } else if (e.value == "time") {

    var walk_t = getSpendTime("#walk");
    var bus_t = getSpendTime("#bus");
    var mrt_t = getSpendTime("#mrt");

    if (walk_t <= bus_t && walk_t <= mrt_t) {
      str = walk;
      src = "url(images/walking.png)";
    }
    else if (bus_t <= walk_t && bus_t <= mrt_t) {
      str = bus;
      src = "url(images/bus.png)";
      createMap = true;
    }
    else {
      str = mrt;
      src = "url(images/mrt.png)";
    }
  } else if (e.value == "distance") {

    var walk_d = getDistance("#walk");
    var bus_d = getDistance("#bus");
    var mrt_d = getDistance("#mrt");

    if (walk_d <= bus_d && walk_d <= mrt_d) {
      str = walk;
      src = "url(images/walking.png)";
    }
    else if (bus_d <= walk_d && bus_d <= mrt_d) {
      str = bus;
      src = "url(images/bus.png)";
      createMap = true;
    }
    else {
      str = mrt;
      src = "url(images/mrt.png)";
    }
  }

  word.innerHTML = str;
  imgDiv["style"]["backgroundImage"] = src;
  imgDiv["style"]["backgroundSize"] = "100% 100%";

  //if (createMap)
  //  createBusMap();
}

function createBusMap() {

  var word = document.getElementById("word");
  var num = word.innerHTML.split("<br>")[2].split("(")[1].replace(")", "");
  var url = "http://ptx.transportdata.tw/MOTC/v1/Bus/Stop/Taipei/" + num + "?%24top=30&%24format=JSON";

  $.getJSON(url, function (json) {
    var btn = document.createElement("button");
    btn.innerHTML = '搜尋' + word.innerHTML.split("<br>")[2].split("：")[1];
    word.appendChild(btn);
    btn.addEventListener("click", function (e) {


      var map = document.createElement("div");
      map.style["width"] = "100%";
      map.style["height"] = "auto";
      word.appendChild(map);


      var neighborhoods = [
    { lat: 52.511, lng: 13.447 },
    { lat: 52.549, lng: 13.422 },
    { lat: 52.497, lng: 13.396 },
    { lat: 52.517, lng: 13.394 }
      ];

      var markers = [];
      var map;
      initMap();
      function initMap() {
        map = new google.maps.Map(document.getElementById('map'), {
          zoom: 12,
          center: { lat: 52.520, lng: 13.410 }
        });
      }

      function drop() {
        clearMarkers();
        for (var i = 0; i < neighborhoods.length; i++) {
          addMarkerWithTimeout(neighborhoods[i], i * 200);
        }
      }

      function addMarkerWithTimeout(position, timeout) {
        window.setTimeout(function () {
          markers.push(new google.maps.Marker({
            position: position,
            map: map,
            animation: google.maps.Animation.DROP
          }));
        }, timeout);
      }

      function clearMarkers() {
        for (var i = 0; i < markers.length; i++) {
          markers[i].setMap(null);
        }
        markers = [];
      }

    });
  });
}

function createCombobox(id) {
  var optionJson;
  $.getJSON("https://raw.githubusercontent.com/NatLee/2016IISI-HACKATHON/gh-pages/assets/MRTstationJson.json?token=ASmQ94nvo1HJRwz3kRnda2AnZURZJsXGks5XU7yzwA%3D%3D", function (json) {
    optionJson = json;
    var select = $(id)[0];

    var newOptions = [];
    for (var i = 0; i < optionJson.length; i++) {
      var line = json[i]["line"];
      var lineHasCreate = false;


      for (var j = 0; j < newOptions.length; j++) {
        if (newOptions[j] == line) {
          lineHasCreate = true;
          break;
        }
      }
      var axis = optionJson[i]["latitude"] + "," + optionJson[i]["longitude"];

      if (!lineHasCreate) {
        var optgroup = document.createElement("optgroup");
        optgroup.setAttribute("label", line);
        var option = document.createElement("option");
        option.setAttribute("value", axis);
        option.innerHTML = "捷運" + optionJson[i]["name"];

        optgroup.appendChild(option);
        select.appendChild(optgroup);
        newOptions.push(line);
      } else {
        var temp = $("optgroup", select);
        for (var k = 0; k < temp.length; k++) {
          if (temp[k].label == line) {
            temp = temp[k];
            var option = document.createElement("option");
            option.setAttribute("value", axis);
            option.innerHTML = "捷運" + optionJson[i]["name"];
            temp.appendChild(option);
          }
        }
      }
    }
  });
}

function changeEvent(e) {
  var startValue = $("#start")[0].value;
  var endValue = $("#end")[0].value;

  $("#start")[0].value = endValue;
  $("#end")[0].value = startValue;
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


  $("#word")[0].innerHTML = "";
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
    var bus_m = $("#bus")[0].innerHTML.split("<br>")[3].split("$")[1] * 1;
    var mrt_m = $("#mrt")[0].innerHTML.split("<br>")[3].split("$")[1] * 1;
    temp[0]["size"] = 1;
    temp[1]["size"] = bus_m == 0 ? 1 : bus_m;
    temp[2]["size"] = mrt_m == 0 ? 1 : mrt_m;
  }
  else if (mode == "distance")//距離
  {
    temp[0]["size"] = getDistance("#walk");
    temp[1]["size"] = getDistance("#bus");
    temp[2]["size"] = getDistance("#mrt");
  }
  else if (mode == "time") {
    temp[0]["size"] = getSpendTime("#walk");
    temp[1]["size"] = getSpendTime("#bus");
    temp[2]["size"] = getSpendTime("#mrt");
  }
  return js;
}

function getDistance(id) {
  return $(id)[0].innerHTML.split("<br>")[6].split("：")[1].split(" ")[0] * 1;
}

function getSpendTime(id) {
  if (id != "#walk") {
    var D = $(id)[0].innerHTML.split("<br>")[4].split("：")[1].replace("上午", "").replace("下午1:", "13:").replace("下午", "").split(":");
    var A = $(id)[0].innerHTML.split("<br>")[5].split("：")[1].replace("上午", "").replace("下午1:", "13:").replace("下午", "").split(":");
    return (A[0] - D[0]) * 60 + (A[1] - D[1]) * 1;
  }
  else {
    var w = $(id)[0].innerHTML.split("<br>")[4].split("：")[1].replace("分", "").split("小時");
    if (w.length > 1)
      return w[0] * 60 + w[1] * 1;
    else
      return w[0] * 1;
  }
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
  var r = Math.floor(Math.random() * 105) + 150;
  var g = Math.floor(Math.random() * 105) + 150;
  var b = Math.floor(Math.random() * 105) + 150;
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

var initialLocation;
var taipei = new google.maps.LatLng(25.09108, 121.5598);
var browserSupportFlag = new Boolean();

function geoFindMe() {


  var myOptions = {
    zoom: 15,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

  // Try W3C Geolocation (Preferred)
  if (navigator.geolocation) {
    browserSupportFlag = true;
    navigator.geolocation.getCurrentPosition(function (position) {
      initialLocation = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      var lat = position.coords.latitude;
      var lon = position.coords.longitude;

      var options = $("option", $("#start")[0]);
      var sortest = "";
      var num = 99999999;

      for (var i = 0; i < options.length; i++) {
        var a = options[i].value.split(',');

        var temp = userToMRTDistance(lat, lon, a[0], a[1])
        if (temp <= num) {
          sortest = a[0] + "," + a[1];
          num = temp;
        }
      }

      $("#start")[0].value = sortest;
      map.setCenter(initialLocation);
    }, function (p) {
      handleNoGeolocation(browserSupportFlag);
    });
  }
    // Browser doesn't support Geolocation
  else {
    browserSupportFlag = false;
    handleNoGeolocation(browserSupportFlag);
  }

  function handleNoGeolocation(errorFlag) {
    if (errorFlag == true)
      alert("地圖定位失敗");
    else
      alert("您的瀏覽器不支援定位服務");

    initialLocation = taipei;
    map.setCenter(initialLocation);
  }




  //var output = document.getElementById("out");

  //if (!navigator.geolocation) {
  //  output.innerHTML = "<p>Geolocation is not supported by your browser</p>";
  //  return;
  //}

  //function success(position) {

  //  var lat = position.coords.latitude;
  //  var lon = position.coords.longitude;

  //  var options = $("option", $("#start")[0]);
  //  var sortest = "";
  //  var num = 99999999;

  //  for (var i = 0; i < options.length; i++) {
  //    var a = options[i].value.split(',');

  //    var temp = userToMRTDistance(lat, lon, a[0], a[1])
  //    if (temp <= num) {
  //      sortest = a[0] + "," + a[1];
  //      num = temp;
  //    }
  //  }

  //  $("#start")[0].value = sortest;

  //  if (output.style.display == "block")
  //    return
  //  else {
  //    var img = new Image();
  //    img.src = "https://maps.googleapis.com/maps/api/staticmap?center=" + lat + "," + lon + "&zoom=13&size=500x300&sensor=false";

  //    img.style.width = "100%";
  //    output.appendChild(img);
  //    output.style.display = "block";
  //  }
  //};

  //function error(err) {
  //  output.innerHTML = 'ERROR(' + err.code + '): ' + err.message;//"Unable to retrieve your location";
  //};

  //var options = {
  //  enableHighAccuracy: true,
  //  timeout: 5000,
  //  maximumAge: 0
  //};
  ////output.innerHTML = "<p>Locating…</p>";

  //navigator.geolocation.getCurrentPosition(success, error, options);
}

function userToMRTDistance(lat1, lon1, lat2, lon2) {//計算兩位置(使用者與目標)距離
  var R = 6371; // km (change this constant to get miles)
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
   Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
   Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return Math.round(d * 1000);//公尺
}

function choiceStation() {
  var win2 = window.open("/2016IISI-HACKATHON/index2.html");//

}

init();
