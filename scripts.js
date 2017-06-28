var app = angular.module("firstApp", []);
//https://github.com/michalbe/wiki-infobox/blob/master/index.js

app.config(['$httpProvider', function($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    $httpProvider.defaults.withCredentials = true;
    delete $httpProvider.defaults.headers.common["X-Requested-With"];
    $httpProvider.defaults.headers.common["Accept"] = "application/json";
    $httpProvider.defaults.headers.common["Content-Type"] = "application/json";
}
]);

app.controller("MyFirstController", function($scope, $http, $timeout) {
    console.log('hello world');

    var titles = ['Popular%20Science', 'PC%20Magazine', 'TechCrunch', 'Gizmodo', 'The%20Verge', 'GeekWire'];
    var wikiURL = 'http://en.wikipedia.org/wiki/';
    $scope.data = [];
    var parse = function(text) {
        var brackets = 0;

        for (var i = 0, l = text.length; i < l; i++) {
            if (text.charAt(i) === '{') {
                brackets++;
            } else if (text.charAt(i) === '}') {
                brackets--;
            }

            if (brackets === 0 && i > 0) {
                return i - 1;
            }
        }
    };

    var stringToObject = function(name, value) {
        // We can find a lot of objects in one infobox field, so we
        // Gotta Catch 'Em All using simple trick with .replace() callback
        var matches = [];
        var fullMatches = [];
        var pom = value;
        value.replace(/[[\]]/g, '')

        console.log('value', value);
        value.replace(/\[\[(.*?)\]\]/g, function(g0, g1) {
            matches.push(g1);
        });
        // After we get every markdown element from the string we are looking for
        // unmatched text in between
        matches.forEach(function(entry) {
            console.log('entry', entry)
            // For every match we split string in two so only pure text will left
            // in pom[0]
            pom = pom.split('[[' + entry + ']]');
            // Is our clean text something more meaningful than white spaces or any
            // of those: <, . :>
            if (pom[0].match(/\S/) && pom[0].match(/^\s*[\.\,\:]*\s$/) === null) {
                // If it is we are good
                fullMatches.push({
                    type: 'text',
                    value: pom[0]
                });
            }
            fullMatches.push(entry);
            //only second part of split is going to analise
            pom = pom[1];
        });

        // Now let's take care of the string that left after foreach
        if (pom.match(/\S/) && pom.match(/^\s*[\.\,\:]*\s$/) === null) {
            fullMatches.push({
                type: 'text',
                value: pom
            });
        }
        if (fullMatches.length > 0) {
            var results = [];
            var obj;
            fullMatches.forEach(function(matchElement) {
                // If it's an image, set the type to image
                if (typeof (matchElement) != 'object') {
                    if (
                            matchElement.indexOf('File:') > -1 ||
                            matchElement.indexOf('Image:') > -1
                    ) {
                        obj = {
                            type: 'image'
                        };
                    } else {
                        // If not, its almost always a link
                        obj = {
                            type: 'link'
                        };
                    }

                    matchElement = matchElement.split('|');
                    if (matchElement.length > 1) {
                        obj.text = matchElement[1];
                        obj.url = wikiURL + matchElement[0];
                    } else {
                        obj.text = matchElement[0];
                        obj.url = wikiURL + matchElement[0];
                    }
                    results.push(obj);
                } else {
                    results.push(matchElement);
                }
            });

            // Sometimes field is just a text, without any fireworks :(
            if (results.length === 1) {
                results = results.pop();
            }
            return results;

        } else {
            return {
                type: 'text',
                value: value
            };
        }
    };



    var getData = function(title) {
        $.getJSON("http://en.wikipedia.org/w/api.php?action=parse&page=" + title + "&prop=images&format=json&callback=?", function(data) {
            var imgsHtml = "";
            //console.log('first data', data);
            var obj = {}
            obj.title = data['parse']['title'];
            //console.log('img', img);
            $.getJSON("http://en.wikipedia.org/w/api.php?action=query&titles=Image:" + data["parse"]["images"][1] + "&prop=imageinfo&iiprop=url&meta=siteinfo&siprop=rightsinfo&format=json&callback=?").then(function(data) {
                var key = Object.keys(data["query"]["pages"])[0];
                //console.log('results', data);

                var imageUrl = data["query"]["pages"][key]["imageinfo"][0]["url"];

                //console.log('done', imageUrl);
                //$timeout(function() {
                obj.url = imageUrl;
                //$scope.data.push(obj);
                //console.log('data', obj);
                //});

            }).then(function() {
                $.getJSON("https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&titles=" + title + "&format=json&callback=?"
                    , function(data) {

                        //console.log('data', data);
                        var key = Object.keys(data["query"]["pages"])[0];
                        var content = data['query']['pages'][key].revisions[0]['*'];
                        //console.log('content', content);
                        var startingPointRegex = /\{\{\s*[Ii]nfobox/;
                        var startArray = content.match(startingPointRegex);
                        if (!startArray) {
                            console.log('no infobox found');
                        }
                        var start = startArray.index;
                        var end = parse(content.substr(start, content.length));
                        content = content.substr(start + 2, end);
                        content = content.replace(/\n/g, ' ');
                        var result = content.match(/\[\[(.+?)\]\]|\{\{(.+?)\}\}/ig);

                        // Iterate thru all of them if any
                        if (result !== null) {
                            result.forEach(function(link) {
                                // And replace each '|' for our custom, random separator string
                                content = content.replace(link, link.replace(/\|/g, 'abc'));
                            });
                        }
                        content = content.split('|');
                        content.shift();

                        var output = {};
                        // Iterate thru all the fields of the infobox
                        content.forEach(function(element) {
                            // Every field is a key=value pair, separated by '='
                            var splited = element.split('=');

                            // Some of them have a lot of white characters what makes no sense at all,
                            // so let's trim them.
                            splited = splited.map(function(el) {
                                return el.trim();
                            });
                            //console.log('splited', splited);
                            try {
                                output[splited[0]] = stringToObject(
                                    splited[0],
                                    splited[1].replace(new RegExp('abc', 'g'), '|')
                                );

                            } catch ( e ) {
                                //console.log('error', e);
                            }

                        });
                        console.log('content', output);
                        if (output.hasOwnProperty('website')) {
                            var str = output['website']['value'];
                            str = str.replace(/[{()}]/g, '');
                            if (str.indexOf('|') > -1) {
                                str = str.split('|')[1];
                            }
                            obj.site = str;
                        }
                        if (output.hasOwnProperty('url')) {
                            var str = output['url']['value'];
                            str = str.replace(/[{()}]/g, '');
                            if (str.indexOf('|') > -1) {
                                str = str.split('|')[1];
                            }
                            // str = str.split('|')[1];
                            obj.site = str;
                        }
                        if (output.hasOwnProperty('type')) {
                            obj.type = output['type']['value'];
                        }
                        if (output.hasOwnProperty('firstdate')) {

                            var str = output['firstdate']['value'];
                            str = str.replace(/[{()}]/g, '');
                            // if (str.indexOf('|') > -1) {
                            //     str = str.split('|')[1];
                            // }
                            obj.date = str;
                        }
                        if (output.hasOwnProperty('founded')) {

                            var str = output['founded']['value'];
                            str = str.replace(/[{()}]/g, '');
                            // if (str.indexOf('|') > -1) {
                            //     str = str.split('|')[1];
                            // }
                            obj.date = str;
                        }
                        if (output.hasOwnProperty('launchdate')) {
                            var str = output['launchdate']['value'];

                            str = str.replace(/[{()}]/g, '');
                            // if (str.indexOf('|') > -1) {
                            //     str = str.split('|')[1];
                            // }
                            obj.date = str;
                        }
                        if (output.hasOwnProperty('launch date')) {
                            obj.date = output['launch date']['value'];
                        }
                        if (output.hasOwnProperty('launch_date')) {
                            var str = output['launch_date']['value'];

                            str = str.replace(/[{()}]/g, '');
                            // if (str.indexOf('|') > -1) {
                            //     str = str.split('|')[1];
                            // }
                            obj.date = str;
                        }
                        if (output.hasOwnProperty('editor')) {
                            obj.editor = output['editor']['value'];
                        }
                        if (output.hasOwnProperty('edit%20or')) {
                            obj.editor = output['edit%20or']['value'];
                        }
                        if (output.hasOwnProperty('author')) {
                            obj.editor = output['author']['value'];
                        }
                        $timeout(function() {
                            $scope.data.push(obj);
                        })


                    })
            })


        });

    }

    for (var i = 0; i < titles.length; i++) {
        getData(titles[i]);
    }

})
