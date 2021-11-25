import http.server
import socketserver
import sys
import argparse
import os
import re
import mimetypes


class MyHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # http.server.SimpleHTTPRequestHandler.do_GET(self)
        basedir_videos = "videos"
        print("path", self.path)

        if self.path.startswith("/videos"):
            video_fn = re.sub(r"^\/", "", self.path)
            self.send_response(200)
            self.send_header("Content-type", mimetypes.guess_type(video_fn)[0])
            self.end_headers()
            with open(video_fn, "rb") as video_file:
                self.wfile.write(video_file.read())
            return

        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        html = ""
        if self.path == "/":
            items = []
            for i in os.listdir(basedir_videos):
                if os.path.isdir(os.path.join(basedir_videos, i)):
                    items.append('<a href="">{}/</a>'.format(i))
                else:
                    items.append('<a href="{i}.html">{i}</a>'.format(i=i))

            html = "<ul><li>{}</li></ul>".format("</li><li>".join(items))

        elif self.path.endswith(".html"):
            print("xxx", self.path)
            with open("video.css", "r", encoding="utf8") as css_file:
                css = css_file.read()

            video_file = os.path.join(basedir_videos, self.path[1:].replace(".html", ""))
            print("video_file", video_file)
            html = """<html>
            <head>
              <style type="text/css">
              {css}
              </style>
            </head>
            <body>
              <h1>{video_file}</h1>
              <video width="320" height="240" controls>
                <source src="{video_file}" type="video/mp4">
                Your browser does not support the video tag.
              </video>
            </body>
            </html>
            """.format(css=css, video_file=video_file)

        self.wfile.write(bytes(html, "utf8"))
        return


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run video server on localhost", formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("-p", "--port", type=int, default=8080, help="set the port which the local server is listening to")

    args = parser.parse_args()

    # handler = http.server.SimpleHTTPRequestHandler
    handler = MyHTTPHandler

    """
    with http.server.HTTPServer(("", args.port), handler) as httpd:
        print("Server started at http://localhost:" + str(args.port))
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.server_close()
            sys.exit(0)
    """

    socketserver.TCPServer.allow_reuse_address = True
    socketserver.TCPServer.timeout = None  # no timeout
    with socketserver.TCPServer(("", args.port), handler) as httpd:
        print("Server started at http://localhost:" + str(args.port))
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.server_close()
            sys.exit(0)
