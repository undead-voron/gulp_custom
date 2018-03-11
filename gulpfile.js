// globals
var g_password = 'OtISNxEz';

// gulp and related plugins
var gulp = require('gulp');
var plugins = require('gulp-load-plugins')({
		pattern: [
			'gulp-*',
			'gulp.*',
			'main-bower-files'
		]
	});
var glob = require('glob');
var handlebars = require('handlebars');
var path = require('path');
var fs = require('fs');
var fse = require('fs-extra');
var exec = require('child_process').execSync;
var zip = require('gulp-zip');
var decompress = require('gulp-decompress');

// less2js prefix & suffix
var g_prefix = 'function injectCSS(css) {'
		+ 'css = css || "';
var g_suffix = '";'
		+ 'var headEl = document.getElementsByTagName("head")[0];'
		+ 'var styleEl = document.createElement("style");'
		+ 'headEl.appendChild(styleEl);'
		+ 'if (styleEl.styleSheet) {'
			+ 'if (!styleEl.styleSheet.disabled) {'
				+ 'styleEl.styleSheet.cssText = css;'
			+ '}'
		+ '} else {'
			+ 'try {'
				+ 'styleEl.innerHTML = css;'
			+ '} catch(e) {'
				+ 'styleEl.innerText = css;'
			+ '}'
		+ '}'
	+ '}';


var CUSTOM_FOLDER_PATH = path.join(path.resolve(__dirname), '..', 'custom');

var firefoxRegistrationKey;
/*
gulp.task('ffKey', function(){
	// Uncomment and define your firefox key in it and add it. This object will be injected into your firefox manifest
	firefoxRegistrationKey = {
		"gecko": {
			"id": "{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}",
			"strict_min_version": "52.0",
			"update_url": "https://s3-us-west-2.amazonaws.com/gs-addons/petfinder_update_firefox.json"
		}
	};
});
*/

gulp.task('backup', backup);

gulp.task('prepare', prepare);

gulp.task('compile-content-html', function() {
	return compileHtml('../resources/templates/content', '../custom/content', 'templates.js');
});

gulp.task('compile-content-css', function() {
	return compileCss('../resources/templates/content/css', '../custom/content', 'style.js');
});

gulp.task('compile-popup-html', function() {
	return compileHtml('../resources/templates/popup', '../custom/popup/js', 'templates.js');
});

gulp.task('compile-popup-css', function() {
	return compileCss('../resources/templates/popup/css', '../custom/popup/js', 'style.js');
});

gulp.task('compile-html', ['compile-content-html', 'compile-popup-html']);
gulp.task('compile-css', ['compile-content-css', 'compile-popup-css']);

gulp.task('compile-templates', ['compile-html', 'compile-css']);

gulp.task('build', ['backup', 'prepare', 'compile-templates'], build);

gulp.task('restore', function() {
	return gulp.src('**/*.*', {cwd: '../backupAF'}).pipe(gulp.dest(process.env.ADDONS_FRAMEWORK_PATH));
});

gulp.task('clean', ['restore'], function() {
	return gulp.src('../backupAF')
		.pipe(plugins.clean({force: true}));
});

gulp.task('legacy', ['backup', 'prepare', 'compile-templates', 'build', 'restore', 'clean']);

gulp.task('build-ie', ['backup', 'prepare', 'compile-templates'], function(){
	buildFunc(true, true);
});

gulp.task('ie', ['backup', 'prepare', 'compile-templates', 'build-ie', 'restore', 'clean'], function(){
	deleteFolderRecursive(path.join(path.resolve(__dirname), '..', 'temp'));
});

gulp.task('build-no-ie', ['backup', 'prepare', 'compile-templates'], function(){
	buildFunc(false);
});

var noIETasks = ['backup', 'prepare', 'compile-templates', 'build-no-ie', 'restore', 'clean'];
// if ffKay task exists.
if (gulp.tasks['ffKey']) noIETasks.push('ffKey');

gulp.task('no-ie', noIETasks, afterNoIe);

gulp.task('default', ['ie', 'no-ie'], function(){
	console.log('Don\'t forget to check the log above. Information on IE build can be found there.');
});

function backup() {
	var files = glob.sync('**/*.*', {cwd: '../customAF'});

	return gulp.src(
		files,
		{
			cwd: process.env.ADDONS_FRAMEWORK_PATH,
			base: process.env.ADDONS_FRAMEWORK_PATH
		}
	)
		.pipe(gulp.dest('../backupAF'));
}

function prepare() {
	var files = plugins.mainBowerFiles({
		overrides: {
			backbone: {
				main: [
					'backbone-min.js',
					'backbone-min.map'
				]
			},
			handlebars: {
				main: 'handlebars.runtime.min.js'
			},
			underscore: {
				main: [
					'underscore-min.js',
					'underscore-min.map'
				]
			}
		}
	});

	return gulp.src(files)
		.pipe(gulp.dest('../custom/libs'));
}

function compileHtml(cwd, destFolder, destFileName) {
	return gulp.src('**/*.handlebars', {cwd: cwd})
		.pipe(
			plugins.minifyHtml({
				empty: true,
				spare: true,
				quotes: true
			})
		)
		.pipe(
			plugins.handlebars({
				handlebars: handlebars
			})
		)
		.pipe(plugins.wrap('Handlebars.template(<%= contents %>)'))
		.pipe(
			plugins.declare({
				namespace: 'templates',
				noRedeclare: true,
				root: 'Handlebars'
			})
		)
		.pipe(plugins.concat(destFileName))
		.pipe(plugins.uglify())
		.pipe(gulp.dest(destFolder));
}

function compileCss(cwd, destFolder, destFileName) {
	return gulp.src('**/*.less', {cwd: cwd})
		.pipe(plugins.less({
			paths: [
				path.join(__dirname, '..', 'resourses', 'templates')
			]
		}))
		.pipe(plugins.concat(destFileName))
		.pipe(plugins.minifyCss())
		.pipe(plugins.css2js({
			prefix: g_prefix,
			suffix: g_suffix
		}))
		.pipe(plugins.uglify())
		.pipe(gulp.dest(destFolder));
}

function build() {

	var exec = require('child_process').execSync;
	var path = require('path');

	return exec(
		'cscript '
		+ path.join(process.env.ADDONS_FRAMEWORK_PATH, 'pack', 'utils', 'pack.min.js')
		+ ' -path ' + CUSTOM_FOLDER_PATH
		+ ' -password ' + g_password,
		{
			stdio: [0, 1, 2]
		}
	);

}

function afterNoIe(){
	// remove temporal folder
	//deleteFolderRecursive(path.join(path.resolve(__dirname), '..', 'temp'));

	// get config.xml
	var configStr = Buffer.from(fs.readFileSync(path.join(CUSTOM_FOLDER_PATH, 'config.xml'))).toString();

	// TODO: check if > symbol is in properties value
	// TODO: use RegExp instead mere string methods. It should lessen the code
	// get addon tag
	var addonTag = configStr.substr(
		configStr.indexOf('<addon'),
		configStr.substr(configStr.indexOf('<addon'), configStr.length - configStr.indexOf('<addon')).indexOf('>')+1
	);
	// get filename
	var fileName = getProp(addonTag, 'filename');
	// get browsers part
	var browsersStr = configStr.substr(
		configStr.indexOf('<browser>') +9,
		configStr.indexOf('</browser>') - (configStr.indexOf('<browser>')+9)
	);

	browsersStr = browsersStr.replace(/(<!--)+?.*(-->)+?/g, '');

	// get object with info on browsers
	var browsersObj = manageBrowsers(browsersStr);
	console.log(browsersObj);

	// check if firefox in the browsers' list
	if (browsersObj['firefox']){
		// build firefox zip from chrome
		gulp.src(path.join(path.resolve(__dirname), browsersObj['chrome'].output, fileName+'_chrome.zip'))
			.pipe(decompress({strip: 0}))
			.pipe(gulp.dest(path.join(path.resolve(__dirname), browsersObj['firefox'].output, 'firefox_temp')))
			.on('end', function(){
				// delete standard chrome key
				fs.unlinkSync( path.join(path.resolve(__dirname), browsersObj['firefox'].output, 'firefox_temp', 'key.pem'));

				// get firefox update tag
				var updateTag = /<update>.*?<firefox.*?\/>.*?<\/update>/.exec(configStr);
				if (updateTag.length === 1){
					var xpiPath = /extensionUrl=('.*?'|".*?")+?/.exec(/<firefox.*?\/>/.exec(updateTag[0])[0])[0];
					console.log(xpiPath)
				}

				// for some reason gulp would throw an error if variable is undefined. let's check the variable's type instead
				if(typeof firefoxRegistrationKey !== 'undefined'){
					// check id
					var exp = /^{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}}$/;
					if (exp.test(firefoxRegistrationKey.gecko.id)){

						// get manifest file
						var manifest = Buffer.from(fs.readFileSync(path.join(path.resolve(__dirname), browsersObj['firefox'].output, 'firefox_temp', 'manifest.json'))).toString();
						// add key info into manifest
						manifest = manifest.split("\"content_scripts\"").join("\"applications\":"+JSON.stringify(firefoxRegistrationKey)+",\"content_scripts\"");
						fs.writeFileSync(path.join(path.resolve(__dirname), browsersObj['firefox'].output, 'firefox_temp', 'manifest.json'), manifest);

						// get key's id
						var id = firefoxRegistrationKey["gecko"]["id"].replace('{', '').replace('}', '');
						// get version from manifest
						var configVersion = getProp(addonTag, 'version');

						// add extra json file for firefox.
						if (fs.existsSync(path.join(path.resolve(__dirname), browsersObj['firefox'].output, fileName + '_update_firefox.json'))){
							var updateJSON = fs.readFileSync(path.join(path.resolve(__dirname), browsersObj['firefox'].output, fileName + '_update_firefox.json'));
							// transform stringified json into object
							var updateObj = JSON.parse(updateJSON);

							// filter all elements if the existing json file. The filter is expected to be 0 elements long to allow further json update.
							var checkOldVersions = updateObj.addons[id].updates.filter(function(el){
								var versionArr = el.version.split('.');
								// this is definitely newer version
								if (versionArr.length < configVersion.split('.').length) return versionArr.length > configVersion.split('.').length;
								else return  versionComparing(versionArr, configVersion.split('.'));
							});
							// if there is nothing better or equal to the current version
							if (checkOldVersions.length === 0){
								updateObj.addons[id].updates.unshift({
									"version": configVersion,
									"update_link": firefoxRegistrationKey['gecko']["update_url"]
								});
								fs.writeFileSync(path.join(path.resolve(__dirname), browsersObj['firefox'].output, fileName + '_update_firefox.json'), JSON.stringify(updateObj));
							}
						}else {
							// if file doesn't exist
							var newObj = {addons:{}};
							newObj["addons"][id] = {
								"updates": [{
									"version": configVersion,
									"update_link": firefoxRegistrationKey["gecko"]["update_url"]
								}]
							};
							fs.writeFileSync(path.join(path.resolve(__dirname), browsersObj['firefox'].output, fileName + '_update_firefox.json'), JSON.stringify(newObj));
						}
					}else{
						console.error('Your ID for the FireFox is incorrect!')
					}
				}

				// pack firefox data and delete temporal folder
				gulp.src( path.join(path.resolve(__dirname), browsersObj['firefox'].output, 'firefox_temp') + '\\**\\*')
					.pipe(zip(fileName+'_firefox.zip'))
					.pipe(gulp.dest(path.join(path.resolve(__dirname), browsersObj['firefox'].output)))
					.on('end', function(){
						if (fs.existsSync(path.join(path.resolve(__dirname), browsersObj['firefox'].output, fileName+'_firefox.zip'))){
							deleteFolderRecursive(path.join(path.resolve(__dirname), browsersObj['firefox'].output, 'firefox_temp'));
						}
					});
			});
	}
	deleteFolderRecursive(path.join(path.resolve(__dirname), '..', 'temp'));
}

// expects a part of xml with info on browsers. Returns an object with browsers
function manageBrowsers(fullStr){
	// get rid of unnecessary symbols.
	fullStr = fullStr.substr(fullStr.indexOf('<')+1, fullStr.length - (fullStr.indexOf('<')+1));
	var browsersArr = fullStr.split('<');
	var browsersObj = {};
	browsersArr.forEach(function(el){
		var name = el.substr(0, el.indexOf(' '));
		var str = '<'+ el.substr(0, el.indexOf('>')+1);
		var path = getProp(str, 'output');
		browsersObj[name] = {
			output: path,
			str: str
		};
	});

	return browsersObj;
}

// expects to get a string from xml and returns the requires property
function getProp(str, propName){
	// get start of the property name
	var propPart = str.split(propName)[1];
	var quotationType = str.indexOf('"')>-1 && (str.indexOf('\'') === -1 || str.indexOf('\'')<str.indexOf('"')) ? '"': '\'';
	// return property's value
	return propPart.substr(
		propPart.indexOf(quotationType) + 1,
		propPart.substr(propPart.indexOf(quotationType) + 1, propPart.length - (propPart.indexOf(quotationType) + 1)).indexOf(quotationType)
	);
}

// recursively delete folder's content and the folder itself
function deleteFolderRecursive (currentPath) {
	if( fs.existsSync(currentPath) ) {
		fs.readdirSync(currentPath).forEach(function(file) {
			var curPath = path.join(currentPath, file);
			if(fs.statSync(curPath).isDirectory()) deleteFolderRecursive(curPath);
			else fs.unlinkSync(curPath);
		});
		fs.rmdirSync(currentPath);
	}
}

// expects extension's versions to compare
function versionComparing(higherVersion, lowerVersion){
	// check if version's length is equal
	if (higherVersion.length === lowerVersion.length){
		var i = 0;
		do{
			higherVersion[i] = parseInt(higherVersion[i]);
			lowerVersion[i] = parseInt(lowerVersion[i]);
			if (higherVersion[i] !== lowerVersion[i]) return higherVersion[i] > lowerVersion[i];
			i++;
		}while(higherVersion.length>i);
		return true
	}
}

// main function for building extension
function buildFunc(isIE){

	// delete temp folder is it is already exists.
	deleteFolderRecursive(path.join(path.resolve(__dirname), '..', 'temp'));

	fse.copySync( CUSTOM_FOLDER_PATH, path.join(path.resolve(__dirname), '..', 'temp'));

	var xmlString = Buffer.from(fs.readFileSync(path.join(path.resolve(__dirname), '..', 'temp', 'config.xml'))).toString();
	// parse browsers
	var browsersString = xmlString.substr(
		xmlString.indexOf('<browser>'),
		(xmlString.indexOf('</browser>') + 10) - xmlString.indexOf('<browser>')
	);
	var xmlArr = xmlString.split(browsersString);
	// remove comments
	browsersString = browsersString.replace(/(<!--)+?.*(-->)+?/g, '');
	console.log('check if FireFox required ', /<firefox.*?\/>/.exec(browsersString));

	// manage config.xml and jquery versions for different browsers
	if (isIE){
		// check if ie build required
		if (!(browsersString.indexOf('<ie') > -1)) return;
		// get ie tag from the string and remove any other browser from
		var ieBrowserXml = browsersString.substr(browsersString.indexOf('<ie'), browsersString.substr(browsersString.indexOf('<ie'), browsersString.length-browsersString.indexOf('<ie')).indexOf('/>') + 2);
		// write adjusted xml into file
		fs.writeFileSync(path.join(path.resolve(__dirname), '..', 'temp', 'config.xml'), xmlArr.join('<browser>' + ieBrowserXml +  '</browser>'));
		// put jquery-1.9.1 into the folder with files for further building
		fs.copyFileSync(path.join(path.resolve(__dirname), '..', 'jquery-1.9.1', 'jquery.js'), path.join(path.resolve(__dirname), '..', 'temp', 'libs', 'jquery.js'));
	}else{
		var allBrowsersXml = '';
		if (browsersString.indexOf('<ie')> -1){
			allBrowsersXml = browsersString.split( '<ie' + browsersString.split('<ie')[1].substr(0, browsersString.split('<ie')[1].indexOf('/>')) + '/>');
		}else{
			allBrowsersXml = [browsersString];
		}
		// put adjusted config.xml into temporal folder
		fs.writeFileSync(path.join(path.resolve(__dirname), '..', 'temp', 'config.xml'), xmlArr.join(allBrowsersXml.join('')));
		// put new jquery file into the temporal folder
		fs.copyFileSync(path.join(path.resolve(__dirname), '..', 'jquery-main', 'jquery.js'), path.join(path.resolve(__dirname), '..', 'temp', 'libs', 'jquery.js'));
	}

	return exec(
		'cscript '
		+ path.join(process.env.ADDONS_FRAMEWORK_PATH, 'pack', 'utils', 'pack.min.js')
		+ ' -path ' + path.join(path.resolve(__dirname), '..', 'temp')
		+ ' -password ' + g_password,
		{
			stdio: [0, 1, 2]
		}
	);
}
