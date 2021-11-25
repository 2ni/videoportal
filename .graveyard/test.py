from http.server import HTTPServer, BaseHTTPRequestHandler
from os import curdir, sep, path


class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        try:
            if self.path == "/":
                html = """<html>
                <body>
                  <h1>sachaS01E03.mp4</h1>
                  <video width="320" controls>
                    <source src="videos/sachaS01E03.mp4" type="video/mp4">
                    Your browser does not support the video tag.
                  </video>
                </body>
                </html>
                """

                self.wfile.write(bytes(html, "utf8"))

            elif path.isdir(self.path):
                self.send_response(403)
                self.wfile.write(str.encode("Listing of directories not permited on this server"))
            else:
                f = open(curdir + sep + self.path, 'rb')
                self.wfile.write(f.read())
                f.close()
        except IOError as e:
            print("File " + self.path + " not found")
            print(e)
            self.send_response(404)


httpd = HTTPServer(('localhost', 8080), SimpleHTTPRequestHandler)
httpd.serve_forever()
